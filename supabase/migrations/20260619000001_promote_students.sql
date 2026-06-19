-- ============================================================
-- Migration: 20260619000001_promote_students
-- EduNexus — Tier 1 / F1.3 Year-end Promotion & Roll-over
--
--   Atomically promotes a school's students up the class hierarchy
--   at year-end, graduates the final class, and (optionally) makes a
--   new academic year the current one.
--
--   Input mappings: jsonb array of { "from": <class_uuid>,
--   "to": <class_uuid> | null }. A null/absent "to" graduates that
--   class's students (is_active = false). Promotions move students to
--   the target class and clear their section (admin re-assigns later).
--
--   The promotion is a SINGLE UPDATE ... FROM against the ORIGINAL
--   class membership, so a chained mapping (Class1->2, Class2->3) can
--   never double-promote a student — every row is matched once against
--   its starting class.
--
--   SECURITY DEFINER + an explicit tenant guard (matches
--   get_pending_fees / save_attendance_atomic). Callers use the
--   session client so auth.uid() resolves for the guard.
-- ============================================================

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
BEGIN
  -- Tenant isolation: callers may only promote their own school
  -- (super admins may act on any). Mandatory under SECURITY DEFINER.
  IF NOT (is_super_admin() OR p_school_id = get_my_school_id()) THEN
    RAISE EXCEPTION 'Cannot promote students for another school' USING ERRCODE = '42501';
  END IF;

  -- Validate the target academic year belongs to this school (when given).
  IF p_target_year IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM academic_years ay
      WHERE ay.id = p_target_year AND ay.school_id = p_school_id
    ) THEN
      RAISE EXCEPTION 'Target academic year does not belong to this school' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 1) Graduate the final class(es): mappings whose "to" is null.
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

  -- 2) Promote everyone else. Single statement evaluated against the
  --    ORIGINAL class_id → no cascade / double-promotion.
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

  -- 3) Roll the academic year forward (archive old current, set new).
  IF p_target_year IS NOT NULL THEN
    UPDATE academic_years
    SET is_current = false
    WHERE school_id = p_school_id AND is_current = true;

    UPDATE academic_years
    SET is_current = true
    WHERE id = p_target_year AND school_id = p_school_id;
  END IF;

  RETURN jsonb_build_object('promoted', v_promoted, 'graduated', v_graduated);
END;
$$;

REVOKE ALL ON FUNCTION promote_students(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION promote_students(UUID, UUID, JSONB) TO authenticated;
