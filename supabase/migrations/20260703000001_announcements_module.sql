-- ============================================================
-- Migration: 20260703000001_announcements_module
-- EduNexus — Communication notifications for teacher/admin/manager workflows
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  target_audience TEXT NOT NULL CHECK (target_audience IN ('class_students', 'all_students', 'all_teachers')),
  target_class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcements_school_created
  ON announcements (school_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_school_class
  ON announcements (school_id, target_class_id)
  WHERE deleted_at IS NULL;

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_super ON announcements;
CREATE POLICY announcements_super ON announcements FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS announcements_school_read ON announcements;
CREATE POLICY announcements_school_read ON announcements FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS announcements_staff_insert ON announcements;
CREATE POLICY announcements_staff_insert ON announcements FOR INSERT TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() IN ('school_admin', 'manager', 'cashier', 'teacher')
    AND (
      -- Teacher can only notify class students and only for classes they teach.
      (
        get_my_role() = 'teacher'
        AND target_audience = 'class_students'
        AND target_class_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM user_profiles up
          JOIN teachers t ON t.user_profile_id = up.id
          JOIN teacher_section_assignments tsa ON tsa.teacher_id = t.id
          JOIN sections s ON s.id = tsa.section_id
          WHERE up.auth_user_id = auth.uid()
            AND up.school_id = announcements.school_id
            AND s.class_id = announcements.target_class_id
        )
      )
      OR
      -- School admin / manager / cashier can target class students, all students, or all teachers.
      (
        get_my_role() IN ('school_admin', 'manager', 'cashier')
        AND (
          (target_audience = 'class_students' AND target_class_id IS NOT NULL)
          OR (target_audience IN ('all_students', 'all_teachers') AND target_class_id IS NULL)
        )
      )
    )
  );

DROP POLICY IF EXISTS announcements_staff_update ON announcements;
CREATE POLICY announcements_staff_update ON announcements FOR UPDATE TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (
      get_my_role() IN ('school_admin', 'manager', 'cashier')
      OR (get_my_role() = 'teacher' AND created_by = auth.uid())
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND (
      (get_my_role() = 'teacher' AND created_by = auth.uid() AND target_audience = 'class_students' AND target_class_id IS NOT NULL)
      OR
      (
        get_my_role() IN ('school_admin', 'manager', 'cashier')
        AND (
          (target_audience = 'class_students' AND target_class_id IS NOT NULL)
          OR (target_audience IN ('all_students', 'all_teachers') AND target_class_id IS NULL)
        )
      )
    )
  );

DROP POLICY IF EXISTS announcements_staff_delete ON announcements;
CREATE POLICY announcements_staff_delete ON announcements FOR DELETE TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (
      get_my_role() IN ('school_admin', 'manager', 'cashier')
      OR (get_my_role() = 'teacher' AND created_by = auth.uid())
    )
  );
