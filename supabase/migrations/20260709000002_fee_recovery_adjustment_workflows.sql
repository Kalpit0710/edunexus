-- ============================================================
-- Migration: 20260709000002_fee_recovery_adjustment_workflows
-- EduNexus — Payment recovery + fee adjustment approval workflows
--
-- Adds:
-- 1) fee_payment_recovery_cases (failed/abandoned payment recovery)
-- 2) fee_adjustments (refund/credit-note/adjustment with approval trail)
-- 3) get_pending_fees and promote_students updates to include approved
--    fee adjustments in outstanding-balance math.
-- ============================================================

-- ── Payment recovery workflow table ─────────────────────────

CREATE TABLE IF NOT EXISTS fee_payment_recovery_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  student_id UUID REFERENCES students(id),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'online_gateway', 'offline_queue')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'abandoned')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference_number TEXT,
  failure_reason TEXT,
  narrative TEXT,
  contact_phone TEXT,
  next_follow_up_at TIMESTAMPTZ,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  resolved_payment_id UUID REFERENCES fee_payments(id),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_recovery_school_status
  ON fee_payment_recovery_cases (school_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fee_recovery_student
  ON fee_payment_recovery_cases (school_id, student_id);

ALTER TABLE fee_payment_recovery_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_recovery_read_school_staff ON fee_payment_recovery_cases;
CREATE POLICY fee_recovery_read_school_staff ON fee_payment_recovery_cases
  FOR SELECT
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS fee_recovery_manage_admin_manager ON fee_payment_recovery_cases;
CREATE POLICY fee_recovery_manage_admin_manager ON fee_payment_recovery_cases
  FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND is_admin_or_manager())
  )
  WITH CHECK (
    is_super_admin()
    OR (school_id = get_my_school_id() AND is_admin_or_manager())
  );

-- ── Fee adjustment approval workflow table ──────────────────

CREATE TABLE IF NOT EXISTS fee_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  student_id UUID NOT NULL REFERENCES students(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('refund', 'credit_note', 'adjustment')),
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  narrative TEXT NOT NULL,
  linked_payment_id UUID REFERENCES fee_payments(id),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_adjustments_school_status
  ON fee_adjustments (school_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fee_adjustments_student
  ON fee_adjustments (school_id, student_id, created_at DESC);

ALTER TABLE fee_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_adjustments_read_school_staff ON fee_adjustments;
CREATE POLICY fee_adjustments_read_school_staff ON fee_adjustments
  FOR SELECT
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS fee_adjustments_manage_admin_manager ON fee_adjustments;
CREATE POLICY fee_adjustments_manage_admin_manager ON fee_adjustments
  FOR ALL
  USING (
    is_super_admin()
    OR (school_id = get_my_school_id() AND is_admin_or_manager())
  )
  WITH CHECK (
    is_super_admin()
    OR (school_id = get_my_school_id() AND is_admin_or_manager())
  );

DROP POLICY IF EXISTS fee_adjustments_parent_read_approved ON fee_adjustments;
CREATE POLICY fee_adjustments_parent_read_approved ON fee_adjustments
  FOR SELECT
  USING (
    school_id = get_my_school_id()
    AND status = 'approved'
    AND EXISTS (
      SELECT 1
      FROM parents p
      WHERE p.student_id = fee_adjustments.student_id
        AND p.auth_user_id = auth.uid()
        AND p.school_id = fee_adjustments.school_id
    )
  );

-- ── Promotion RPC updated with approved adjustment math ─────

CREATE OR REPLACE FUNCTION promote_students(
  p_school_id   UUID,
  p_target_year UUID,
  p_mappings    JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted  INTEGER := 0;
  v_graduated INTEGER := 0;
  v_arrears   INTEGER := 0;
  v_source_year UUID;
  v_target_year UUID;
BEGIN
  IF NOT (is_super_admin() OR p_school_id = get_my_school_id()) THEN
    RAISE EXCEPTION 'Cannot promote students for another school' USING ERRCODE = '42501';
  END IF;

  IF p_target_year IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM academic_years ay
      WHERE ay.id = p_target_year AND ay.school_id = p_school_id
    ) THEN
      RAISE EXCEPTION 'Target academic year does not belong to this school' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT ay.id
  INTO v_source_year
  FROM academic_years ay
  WHERE ay.school_id = p_school_id
    AND ay.is_current = true
  LIMIT 1;

  v_target_year := COALESCE(p_target_year, v_source_year);

  IF v_target_year IS NOT NULL THEN
    WITH mappings AS (
      SELECT (e->>'from')::uuid AS from_class,
             NULLIF(e->>'to', '')::uuid AS to_class
      FROM jsonb_array_elements(p_mappings) e
      WHERE NULLIF(e->>'to', '') IS NOT NULL
    ),
    promoted_students AS (
      SELECT s.id AS student_id,
             s.class_id AS source_class_id,
             m.to_class AS target_class_id
      FROM students s
      JOIN mappings m ON m.from_class = s.class_id
      WHERE s.school_id = p_school_id
        AND s.is_active = true
        AND s.deleted_at IS NULL
    ),
    class_fees AS (
      SELECT fs.class_id, SUM(fs.amount)::numeric AS class_total
      FROM fee_structures fs
      WHERE fs.school_id = p_school_id
        AND fs.academic_year_id = v_source_year
        AND fs.is_active = true
        AND fs.deleted_at IS NULL
      GROUP BY fs.class_id
    ),
    library_fines AS (
      SELECT bl.student_id AS sid, SUM(bl.fine_amount)::numeric AS fine_total
      FROM book_loans bl
      WHERE bl.school_id = p_school_id
        AND bl.fine_amount > 0
      GROUP BY bl.student_id
    ),
    prior_arrears AS (
      SELECT sfa.student_id AS sid, SUM(sfa.amount)::numeric AS arrears_total
      FROM student_fee_arrears sfa
      WHERE sfa.school_id = p_school_id
      GROUP BY sfa.student_id
    ),
    approved_adjustments AS (
      SELECT
        fa.student_id AS sid,
        SUM(CASE WHEN fa.direction = 'debit' THEN fa.amount ELSE 0 END)::numeric AS debit_total,
        SUM(CASE WHEN fa.direction = 'credit' THEN fa.amount ELSE 0 END)::numeric AS credit_total
      FROM fee_adjustments fa
      WHERE fa.school_id = p_school_id
        AND fa.status = 'approved'
      GROUP BY fa.student_id
    ),
    student_paid AS (
      SELECT fp.student_id AS sid, SUM(fp.paid_amount)::numeric AS paid_total
      FROM fee_payments fp
      WHERE fp.school_id = p_school_id
      GROUP BY fp.student_id
    ),
    carry_rows AS (
      SELECT
        ps.student_id,
        ps.source_class_id,
        ps.target_class_id,
        GREATEST(
          0,
          COALESCE(cf.class_total, 0)
          + COALESCE(lf.fine_total, 0)
          + COALESCE(pa.arrears_total, 0)
          + COALESCE(adj.debit_total, 0)
          - (COALESCE(sp.paid_total, 0) + COALESCE(adj.credit_total, 0))
        )::numeric(12,2) AS carry_amount
      FROM promoted_students ps
      LEFT JOIN class_fees cf ON cf.class_id = ps.source_class_id
      LEFT JOIN library_fines lf ON lf.sid = ps.student_id
      LEFT JOIN prior_arrears pa ON pa.sid = ps.student_id
      LEFT JOIN approved_adjustments adj ON adj.sid = ps.student_id
      LEFT JOIN student_paid sp ON sp.sid = ps.student_id
    ),
    upserted AS (
      INSERT INTO student_fee_arrears (
        school_id,
        student_id,
        source_class_id,
        target_class_id,
        source_academic_year_id,
        target_academic_year_id,
        label,
        amount,
        created_from_promotion,
        updated_at
      )
      SELECT
        p_school_id,
        c.student_id,
        c.source_class_id,
        c.target_class_id,
        v_source_year,
        v_target_year,
        'Previous Arrears',
        c.carry_amount,
        TRUE,
        now()
      FROM carry_rows c
      WHERE c.carry_amount > 0
      ON CONFLICT (
        school_id,
        student_id,
        source_academic_year_id,
        target_academic_year_id,
        source_class_id,
        target_class_id,
        created_from_promotion
      )
      DO UPDATE SET
        amount = EXCLUDED.amount,
        label = EXCLUDED.label,
        updated_at = now()
      RETURNING id
    )
    SELECT COUNT(*)::int INTO v_arrears FROM upserted;
  END IF;

  UPDATE students s
  SET is_active = false,
      updated_at = now()
  WHERE s.school_id = p_school_id
    AND s.is_active = true
    AND s.deleted_at IS NULL
    AND s.class_id IN (
      SELECT (e->>'from')::uuid
      FROM jsonb_array_elements(p_mappings) e
      WHERE NULLIF(e->>'to', '') IS NULL
    );
  GET DIAGNOSTICS v_graduated = ROW_COUNT;

  UPDATE students s
  SET class_id = m.to_class,
      section_id = NULL,
      updated_at = now()
  FROM (
    SELECT (e->>'from')::uuid AS from_class,
           NULLIF(e->>'to', '')::uuid AS to_class
    FROM jsonb_array_elements(p_mappings) e
    WHERE NULLIF(e->>'to', '') IS NOT NULL
  ) m
  WHERE s.school_id = p_school_id
    AND s.is_active = true
    AND s.deleted_at IS NULL
    AND s.class_id = m.from_class;
  GET DIAGNOSTICS v_promoted = ROW_COUNT;

  IF p_target_year IS NOT NULL THEN
    UPDATE academic_years
    SET is_current = false
    WHERE school_id = p_school_id AND is_current = true;

    UPDATE academic_years
    SET is_current = true
    WHERE id = p_target_year AND school_id = p_school_id;
  END IF;

  RETURN jsonb_build_object(
    'promoted', v_promoted,
    'graduated', v_graduated,
    'arrears_carried', v_arrears
  );
END;
$$;

REVOKE ALL ON FUNCTION promote_students(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION promote_students(UUID, UUID, JSONB) TO authenticated;

-- ── Pending-fees aggregation includes approved adjustments ──

CREATE OR REPLACE FUNCTION get_pending_fees(p_school_id UUID)
RETURNS TABLE (
  student_id       UUID,
  student_name     TEXT,
  admission_number TEXT,
  class_name       TEXT,
  section_name     TEXT,
  total_fee        NUMERIC,
  total_paid       NUMERIC,
  balance          NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_super_admin() OR p_school_id = get_my_school_id()) THEN
    RAISE EXCEPTION 'Cannot read pending fees for another school' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH current_year AS (
    SELECT ay.id
    FROM academic_years ay
    WHERE ay.school_id = p_school_id
      AND ay.is_current = true
    LIMIT 1
  ),
  class_fees AS (
    SELECT fs.class_id, SUM(fs.amount)::NUMERIC AS class_total
    FROM fee_structures fs
    WHERE fs.school_id = p_school_id
      AND fs.academic_year_id = (SELECT cy.id FROM current_year cy)
      AND fs.is_active = true
      AND fs.deleted_at IS NULL
    GROUP BY fs.class_id
  ),
  library_fines AS (
    SELECT bl.student_id AS sid, SUM(bl.fine_amount)::NUMERIC AS fine_total
    FROM book_loans bl
    WHERE bl.school_id = p_school_id
      AND bl.fine_amount > 0
    GROUP BY bl.student_id
  ),
  carried_arrears AS (
    SELECT sfa.student_id AS sid, SUM(sfa.amount)::NUMERIC AS arrears_total
    FROM student_fee_arrears sfa
    WHERE sfa.school_id = p_school_id
      AND (
        sfa.target_academic_year_id IS NULL
        OR sfa.target_academic_year_id = (SELECT cy.id FROM current_year cy)
      )
    GROUP BY sfa.student_id
  ),
  approved_adjustments AS (
    SELECT
      fa.student_id AS sid,
      SUM(CASE WHEN fa.direction = 'debit' THEN fa.amount ELSE 0 END)::NUMERIC AS debit_total,
      SUM(CASE WHEN fa.direction = 'credit' THEN fa.amount ELSE 0 END)::NUMERIC AS credit_total
    FROM fee_adjustments fa
    WHERE fa.school_id = p_school_id
      AND fa.status = 'approved'
    GROUP BY fa.student_id
  ),
  student_paid AS (
    SELECT fp.student_id AS sid, SUM(fp.paid_amount)::NUMERIC AS paid_total
    FROM fee_payments fp
    WHERE fp.school_id = p_school_id
    GROUP BY fp.student_id
  )
  SELECT
    s.id,
    s.full_name,
    COALESCE(s.admission_number, '')::TEXT,
    COALESCE(c.name, '')::TEXT,
    COALESCE(sec.name, '')::TEXT,
    (
      COALESCE(cf.class_total, 0)
      + COALESCE(lf.fine_total, 0)
      + COALESCE(ca.arrears_total, 0)
      + COALESCE(adj.debit_total, 0)
    )::NUMERIC,
    (
      COALESCE(sp.paid_total, 0)
      + COALESCE(adj.credit_total, 0)
    )::NUMERIC,
    (
      COALESCE(cf.class_total, 0)
      + COALESCE(lf.fine_total, 0)
      + COALESCE(ca.arrears_total, 0)
      + COALESCE(adj.debit_total, 0)
      - (COALESCE(sp.paid_total, 0) + COALESCE(adj.credit_total, 0))
    )::NUMERIC
  FROM students s
  LEFT JOIN classes  c   ON c.id   = s.class_id
  LEFT JOIN sections sec ON sec.id = s.section_id
  LEFT JOIN class_fees           cf  ON cf.class_id = s.class_id
  LEFT JOIN library_fines        lf  ON lf.sid      = s.id
  LEFT JOIN carried_arrears      ca  ON ca.sid      = s.id
  LEFT JOIN approved_adjustments adj ON adj.sid     = s.id
  LEFT JOIN student_paid         sp  ON sp.sid      = s.id
  WHERE s.school_id = p_school_id
    AND s.is_active = true
    AND (
      COALESCE(cf.class_total, 0)
      + COALESCE(lf.fine_total, 0)
      + COALESCE(ca.arrears_total, 0)
      + COALESCE(adj.debit_total, 0)
      - (COALESCE(sp.paid_total, 0) + COALESCE(adj.credit_total, 0))
    ) > 0
  ORDER BY (
    COALESCE(cf.class_total, 0)
    + COALESCE(lf.fine_total, 0)
    + COALESCE(ca.arrears_total, 0)
    + COALESCE(adj.debit_total, 0)
    - (COALESCE(sp.paid_total, 0) + COALESCE(adj.credit_total, 0))
  ) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_fees(UUID) TO authenticated;
