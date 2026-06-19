-- ============================================================
-- Migration: 20260619000003_timetable
-- EduNexus — Tier 1 / F1.1 Timetable / Class schedule
--
--   Two tables:
--     * timetable_periods  — school-wide time slots (Period 1, Lunch …)
--     * timetable_entries  — per section × day × period: subject + teacher
--
--   Views built on top:
--     * School admin  — manage periods + edit each section's grid,
--                       plus a teacher-centric read view + conflict
--                       detection (a teacher double-booked in two
--                       sections at the same day+period).
--     * Teacher       — "my timetable" (entries where teacher = me)
--     * Parent        — the linked child's weekly grid (read only)
--
--   RLS:
--     * super admin            : full access
--     * admin / manager        : full manage within their school
--     * teacher                : read within their school
--     * parent                 : read their child's section (+ periods)
-- ============================================================

-- ─── PERIODS (time slots) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                 -- "Period 1", "Lunch", "Assembly"
  start_time    TIME,                          -- null allowed for unscheduled rows
  end_time      TIME,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_break      BOOLEAN NOT NULL DEFAULT FALSE, -- break/lunch → no subject/teacher
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_periods_school_order
  ON timetable_periods (school_id, display_order);

-- ─── ENTRIES (section × day × period) ───────────────────────
CREATE TABLE IF NOT EXISTS timetable_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id   UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  period_id    UUID NOT NULL REFERENCES timetable_periods(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),  -- ISO: Mon=1 … Sun=7
  subject_id   UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id   UUID REFERENCES teachers(id) ON DELETE SET NULL,
  room         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, section_id, day_of_week, period_id)
);

CREATE INDEX IF NOT EXISTS idx_entries_section_day
  ON timetable_entries (school_id, section_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_entries_teacher_day
  ON timetable_entries (school_id, teacher_id, day_of_week);

ALTER TABLE timetable_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

-- ─── PERIODS policies ───────────────────────────────────────
DROP POLICY IF EXISTS periods_super ON timetable_periods;
CREATE POLICY periods_super ON timetable_periods FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS periods_admin_manage ON timetable_periods;
CREATE POLICY periods_admin_manage ON timetable_periods FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS periods_staff_read ON timetable_periods;
CREATE POLICY periods_staff_read ON timetable_periods FOR SELECT TO authenticated
  USING (school_id = get_my_school_id()
         AND get_my_role() IN ('teacher', 'school_admin', 'manager'));

DROP POLICY IF EXISTS periods_parent_read ON timetable_periods;
CREATE POLICY periods_parent_read ON timetable_periods FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parents p
      WHERE p.auth_user_id = auth.uid()
        AND p.school_id = timetable_periods.school_id
    )
  );

-- ─── ENTRIES policies ───────────────────────────────────────
DROP POLICY IF EXISTS entries_super ON timetable_entries;
CREATE POLICY entries_super ON timetable_entries FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS entries_admin_manage ON timetable_entries;
CREATE POLICY entries_admin_manage ON timetable_entries FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS entries_staff_read ON timetable_entries;
CREATE POLICY entries_staff_read ON timetable_entries FOR SELECT TO authenticated
  USING (school_id = get_my_school_id()
         AND get_my_role() IN ('teacher', 'school_admin', 'manager'));

DROP POLICY IF EXISTS entries_parent_read ON timetable_entries;
CREATE POLICY entries_parent_read ON timetable_entries FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM parents p
      JOIN students s ON s.id = p.student_id
      WHERE p.auth_user_id = auth.uid()
        AND s.section_id = timetable_entries.section_id
    )
  );
