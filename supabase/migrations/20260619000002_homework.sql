-- ============================================================
-- Migration: 20260619000002_homework
-- EduNexus — Tier 1 / F1.2 Homework & Daily Diary
--
--   Teachers (and school admins) post homework/diary entries for a
--   class — optionally narrowed to one section and/or subject.
--   Parents read entries for their linked child's class/section.
--
--   RLS:
--     * super admin: full access
--     * staff (teacher | school_admin) in the school: full manage
--     * parents: read entries matching one of their children's
--       class (+ section, when the entry is section-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS homework (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id      UUID REFERENCES sections(id) ON DELETE CASCADE,      -- null = whole class
  subject_id      UUID REFERENCES subjects(id) ON DELETE SET NULL,     -- null = general / diary
  title           TEXT NOT NULL,
  description     TEXT,
  homework_date   DATE NOT NULL DEFAULT current_date,
  due_date        DATE,
  created_by      UUID,            -- auth.uid() of the author
  created_by_name TEXT,            -- denormalized author name for display
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_homework_class_date
  ON homework (school_id, class_id, section_id, homework_date DESC);
CREATE INDEX IF NOT EXISTS idx_homework_author
  ON homework (school_id, created_by);

ALTER TABLE homework ENABLE ROW LEVEL SECURITY;

-- Super admin: full access.
DROP POLICY IF EXISTS homework_super ON homework;
CREATE POLICY homework_super ON homework FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Staff (teacher + school_admin) manage homework within their own school.
DROP POLICY IF EXISTS homework_staff_manage ON homework;
CREATE POLICY homework_staff_manage ON homework FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('teacher', 'school_admin'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('teacher', 'school_admin'));

-- Parents read homework for their linked child's class (+ section when scoped).
DROP POLICY IF EXISTS homework_parent_read ON homework;
CREATE POLICY homework_parent_read ON homework FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM parents p
      JOIN students s ON s.id = p.student_id
      WHERE p.auth_user_id = auth.uid()
        AND s.class_id = homework.class_id
        AND (homework.section_id IS NULL OR s.section_id = homework.section_id)
    )
  );
