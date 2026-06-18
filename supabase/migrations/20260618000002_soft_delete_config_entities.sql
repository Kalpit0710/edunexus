-- ============================================================================
-- Chunk 1.2 — Consistent soft-delete + restore for school configuration entities
-- ----------------------------------------------------------------------------
-- Adds a `deleted_at` column to the config/template tables, swaps their hard
-- UNIQUE constraints for PARTIAL unique indexes (so a deleted name can be
-- recreated), and updates RLS so soft-deleted rows are hidden from every
-- session-client read (both staff-read and school-admin-manage policies).
--
-- Tables: classes, sections, subjects, grading_rules, academic_years,
--         fee_structures.
--
-- Design notes:
--   * The "manage" policies are FOR ALL, so their USING clause also governs
--     school-admin SELECTs. We add `deleted_at IS NULL` to those USING clauses
--     to hide soft-deleted rows from admins too. WITH CHECK intentionally omits
--     `deleted_at` so legitimate inserts/updates of LIVE rows still pass.
--   * Soft-delete and restore are performed in the app layer via the
--     service-role client (which bypasses RLS) with explicit school_id scoping,
--     so we do NOT need the session client to mutate hidden rows.
--   * academic_years had RLS enabled but NO policies (default-deny). We add the
--     standard staff-read + admin-manage policies here, matching the other
--     config tables, while introducing the soft-delete predicate.
--   * Mirrors the existing `students.deleted_at` soft-delete convention.
-- ============================================================================

-- ─── 1. Add deleted_at columns ──────────────────────────────────────────────
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE classes        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sections       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE subjects       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE grading_rules  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ─── 2. Replace hard UNIQUE constraints with partial unique indexes ─────────
-- Drop the auto-named UNIQUE constraints robustly (by matching their column
-- set, regardless of the auto-generated constraint name), then create partial
-- unique indexes scoped to non-deleted rows.

CREATE OR REPLACE FUNCTION public._sd_drop_unique(p_tbl regclass, p_cols text[])
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  WHERE con.conrelid = p_tbl
    AND con.contype = 'u'
    AND (
      SELECT array_agg(a.attname::text ORDER BY a.attname::text)
      FROM unnest(con.conkey) AS k(attnum)
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
    ) = (SELECT array_agg(c ORDER BY c) FROM unnest(p_cols) AS c);

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', p_tbl::text, cname);
  END IF;
END;
$$;

SELECT public._sd_drop_unique('public.academic_years', ARRAY['school_id', 'name']);
SELECT public._sd_drop_unique('public.classes',        ARRAY['school_id', 'name']);
SELECT public._sd_drop_unique('public.sections',       ARRAY['school_id', 'class_id', 'name']);
SELECT public._sd_drop_unique('public.subjects',       ARRAY['school_id', 'class_id', 'name']);
SELECT public._sd_drop_unique('public.fee_structures', ARRAY['school_id', 'class_id', 'category_id', 'academic_year_id']);

DROP FUNCTION public._sd_drop_unique(regclass, text[]);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_years_active
  ON academic_years (school_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_active
  ON classes (school_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sections_active
  ON sections (school_id, class_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_active
  ON subjects (school_id, class_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_structures_active
  ON fee_structures (school_id, class_id, category_id, academic_year_id) WHERE deleted_at IS NULL;

-- ─── 3. Recreate RLS policies with the soft-delete predicate ────────────────

-- CLASSES
DROP POLICY IF EXISTS school_members_read_classes ON classes;
CREATE POLICY school_members_read_classes ON classes
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS school_admin_manage_classes ON classes;
CREATE POLICY school_admin_manage_classes ON classes
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin() AND deleted_at IS NULL)
  WITH CHECK (school_id = get_my_school_id() AND is_school_admin());

-- SECTIONS
DROP POLICY IF EXISTS school_members_read_sections ON sections;
CREATE POLICY school_members_read_sections ON sections
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS school_admin_manage_sections ON sections;
CREATE POLICY school_admin_manage_sections ON sections
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin() AND deleted_at IS NULL)
  WITH CHECK (school_id = get_my_school_id() AND is_school_admin());

-- SUBJECTS
DROP POLICY IF EXISTS school_members_read_subjects ON subjects;
CREATE POLICY school_members_read_subjects ON subjects
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS school_admin_manage_subjects ON subjects;
CREATE POLICY school_admin_manage_subjects ON subjects
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin() AND deleted_at IS NULL)
  WITH CHECK (school_id = get_my_school_id() AND is_school_admin());

-- FEE STRUCTURES
DROP POLICY IF EXISTS school_staff_read_fee_structures ON fee_structures;
CREATE POLICY school_staff_read_fee_structures ON fee_structures
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS school_admin_manage_fee_structures ON fee_structures;
CREATE POLICY school_admin_manage_fee_structures ON fee_structures
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin() AND deleted_at IS NULL)
  WITH CHECK (school_id = get_my_school_id() AND is_school_admin());

-- GRADING RULES (preserve role-based read predicate + explicit WITH CHECK)
DROP POLICY IF EXISTS school_staff_read_grading_rules ON grading_rules;
CREATE POLICY school_staff_read_grading_rules ON grading_rules
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND deleted_at IS NULL
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager', 'cashier']::user_role[])
  );

DROP POLICY IF EXISTS school_admin_manage_grading_rules ON grading_rules;
CREATE POLICY school_admin_manage_grading_rules ON grading_rules
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin() AND deleted_at IS NULL)
  WITH CHECK (school_id = get_my_school_id() AND is_school_admin());

-- ACADEMIC YEARS (no policies existed previously — add standard config policies)
DROP POLICY IF EXISTS school_members_read_academic_years ON academic_years;
CREATE POLICY school_members_read_academic_years ON academic_years
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS school_admin_manage_academic_years ON academic_years;
CREATE POLICY school_admin_manage_academic_years ON academic_years
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin() AND deleted_at IS NULL)
  WITH CHECK (school_id = get_my_school_id() AND is_school_admin());
