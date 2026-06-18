-- ============================================================
-- Migration: 20260618000001_attendance_atomic_save
-- EduNexus — QA Hardening Part 1 / Chunk 1.1
--   Makes attendance saving ATOMIC. Previously the server action
--   did a DELETE followed by a separate INSERT/UPSERT (two round
--   trips, non-transactional): if the insert failed after the
--   delete, the day's attendance was lost with no rollback.
--
--   This RPC performs the delete + insert inside a single
--   function body (one transaction), so either the whole save
--   succeeds or nothing changes. Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION save_attendance_atomic(
  p_school_id   UUID,
  p_class_id    UUID,
  p_section_id  UUID,
  p_date        DATE,
  p_marked_by   UUID,
  p_records     JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  -- Authorization: caller must belong to this school (any staff role can mark,
  -- matching the existing "school_staff_mark_attendance" RLS policy) or be a
  -- super admin.
  IF NOT (is_super_admin() OR p_school_id = get_my_school_id()) THEN
    RAISE EXCEPTION 'Cannot save attendance for another school' USING ERRCODE = '42501';
  END IF;

  IF p_marked_by IS NULL THEN
    RAISE EXCEPTION 'marked_by (staff profile) is required';
  END IF;

  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
    RAISE EXCEPTION 'records must be a JSON array';
  END IF;

  -- 1. Clear existing records for this date/class/section (clean upsert).
  DELETE FROM attendance_records
  WHERE school_id  = p_school_id
    AND class_id   = p_class_id
    AND section_id = p_section_id
    AND date       = p_date;

  -- 2. Re-insert the submitted rows. An empty array is valid (clears the day).
  IF jsonb_array_length(p_records) > 0 THEN
    INSERT INTO attendance_records (
      school_id, student_id, class_id, section_id, date, status, remarks, marked_by
    )
    SELECT
      p_school_id,
      (rec->>'student_id')::UUID,
      p_class_id,
      p_section_id,
      p_date,
      (rec->>'status')::attendance_status,
      NULLIF(rec->>'remarks', ''),
      p_marked_by
    FROM jsonb_array_elements(p_records) AS rec;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION save_attendance_atomic(UUID, UUID, UUID, DATE, UUID, JSONB) TO authenticated;
