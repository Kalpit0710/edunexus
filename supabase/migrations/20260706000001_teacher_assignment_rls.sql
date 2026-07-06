-- ============================================================
-- Migration: 20260706000001_teacher_assignment_rls
-- EduNexus — RLS policies for teacher_section_assignments
-- ============================================================

ALTER TABLE teacher_section_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_all_teacher_assignments ON teacher_section_assignments;
CREATE POLICY super_admin_all_teacher_assignments ON teacher_section_assignments
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS school_staff_read_teacher_assignments ON teacher_section_assignments;
CREATE POLICY school_staff_read_teacher_assignments ON teacher_section_assignments
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() IN ('school_admin', 'teacher', 'manager', 'cashier')
  );

DROP POLICY IF EXISTS school_admin_manage_teacher_assignments ON teacher_section_assignments;
CREATE POLICY school_admin_manage_teacher_assignments ON teacher_section_assignments
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin())
  WITH CHECK (
    school_id = get_my_school_id()
    AND is_school_admin()
    AND EXISTS (
      SELECT 1
      FROM teachers t
      WHERE t.id = teacher_id
        AND t.school_id = school_id
    )
    AND EXISTS (
      SELECT 1
      FROM sections s
      WHERE s.id = section_id
        AND s.school_id = school_id
    )
    AND (
      subject_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM subjects sub
        WHERE sub.id = subject_id
          AND sub.school_id = school_id
      )
    )
  );
