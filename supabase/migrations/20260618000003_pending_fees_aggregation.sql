-- ============================================================
-- Migration: 20260618000003_pending_fees_aggregation
-- EduNexus — QA Hardening Part 4 / Chunk 4.2
--   Moves the pending-fee aggregation out of JavaScript and into
--   the database. Previously getPendingFees() pulled EVERY active
--   student AND EVERY fee_payment row for the school into the Node
--   process and joined them in memory — an unbounded read that
--   grows with payment history.
--
--   This function aggregates payments and fee structures in SQL and
--   returns only the students who still owe money (balance > 0),
--   sorted by balance DESC. Payload is bounded to the pending set
--   instead of "all payments ever".
--
--   Behaviour mirrors the prior JS exactly:
--     * total fee  = SUM(active fee_structures.amount) for the
--                    student's class in the CURRENT academic year
--     * total paid = SUM(fee_payments.paid_amount) for the student
--                    across all time (NOT year-filtered)
--     * include row only when (total fee - total paid) > 0
--   Soft-deleted fee_structures (deleted_at) are excluded, matching
--   the session-client RLS behaviour from Chunk 1.2.
-- ============================================================

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
  -- Tenant isolation: callers may only read their own school's data
  -- (super admins may read any). SECURITY DEFINER bypasses RLS, so this
  -- guard is mandatory — it matches the save_attendance_atomic pattern.
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
    COALESCE(cf.class_total, 0)::NUMERIC,
    COALESCE(sp.paid_total, 0)::NUMERIC,
    (COALESCE(cf.class_total, 0) - COALESCE(sp.paid_total, 0))::NUMERIC
  FROM students s
  LEFT JOIN classes  c   ON c.id   = s.class_id
  LEFT JOIN sections sec ON sec.id = s.section_id
  LEFT JOIN class_fees   cf ON cf.class_id  = s.class_id
  LEFT JOIN student_paid sp ON sp.sid       = s.id
  WHERE s.school_id = p_school_id
    AND s.is_active = true
    AND (COALESCE(cf.class_total, 0) - COALESCE(sp.paid_total, 0)) > 0
  ORDER BY (COALESCE(cf.class_total, 0) - COALESCE(sp.paid_total, 0)) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_fees(UUID) TO authenticated;
