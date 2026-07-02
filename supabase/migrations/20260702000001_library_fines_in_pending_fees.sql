-- ============================================================
-- Migration: 20260702000001_library_fines_in_pending_fees
-- EduNexus — Fold library fines into a student's outstanding fee balance.
--
--   Problem: library fines are recorded on book_loans.fine_amount but were
--   invisible to the fee ledger, so a student who owed a library fine never
--   appeared in Pending Fees.
--
--   Fix: treat any assessed library fine (fine_amount > 0) as an amount the
--   student owes, added to the "total fee" side of the balance. No new table
--   is needed — the fine already lives on book_loans. A payment recorded via
--   the normal fee-collection flow reduces the aggregate balance as usual.
--
--   Behaviour after this change:
--     total fee  = SUM(active fee_structures.amount for the student's class in
--                  the CURRENT academic year)  +  SUM(book_loans.fine_amount)
--     total paid = SUM(fee_payments.paid_amount) across all time
--     balance    = total fee - total paid   (row shown when balance > 0)
--
--   A student whose ONLY due is a library fine now correctly appears in the
--   Pending Fees list. The shared computeStudentFeeBalance() helper in
--   src/lib/fees/balance.ts is updated in lockstep so the parent fee view and
--   report-card fee guardrail agree with this list.
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
  library_fines AS (
    SELECT bl.student_id AS sid, SUM(bl.fine_amount)::NUMERIC AS fine_total
    FROM book_loans bl
    WHERE bl.school_id = p_school_id
      AND bl.fine_amount > 0
    GROUP BY bl.student_id
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
    (COALESCE(cf.class_total, 0) + COALESCE(lf.fine_total, 0))::NUMERIC,
    COALESCE(sp.paid_total, 0)::NUMERIC,
    (COALESCE(cf.class_total, 0) + COALESCE(lf.fine_total, 0) - COALESCE(sp.paid_total, 0))::NUMERIC
  FROM students s
  LEFT JOIN classes  c   ON c.id   = s.class_id
  LEFT JOIN sections sec ON sec.id = s.section_id
  LEFT JOIN class_fees     cf ON cf.class_id  = s.class_id
  LEFT JOIN library_fines  lf ON lf.sid       = s.id
  LEFT JOIN student_paid   sp ON sp.sid       = s.id
  WHERE s.school_id = p_school_id
    AND s.is_active = true
    AND (COALESCE(cf.class_total, 0) + COALESCE(lf.fine_total, 0) - COALESCE(sp.paid_total, 0)) > 0
  ORDER BY (COALESCE(cf.class_total, 0) + COALESCE(lf.fine_total, 0) - COALESCE(sp.paid_total, 0)) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_fees(UUID) TO authenticated;
