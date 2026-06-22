-- ============================================================
-- Migration: 20260622000001_timetable_enhancements
-- EduNexus — Timetable real-world enhancements
--
--   1. schools.working_days — per-school working week (ISO Mon=1 … Sun=7).
--      Drives the columns of every timetable grid (admin/teacher/parent).
--   2. Supporting index for day+period occupancy lookups (teacher / room
--      conflict checks and the in-cell live-availability hints).
--
--   No new tables: per-section entries + teacher_section_assignments already
--   model "Period 1 = Maths in 6-A, Hindi in 6-B, different teachers".
-- ============================================================

-- ─── Per-school working week ────────────────────────────────
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS working_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6}';

-- Every element must be a valid ISO weekday and the set must be non-empty.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_working_days_valid'
  ) THEN
    ALTER TABLE schools
      ADD CONSTRAINT schools_working_days_valid CHECK (
        array_length(working_days, 1) >= 1
        AND working_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
      );
  END IF;
END $$;

-- ─── Occupancy lookup index (teacher/room clash + live hints) ─
CREATE INDEX IF NOT EXISTS idx_entries_day_period
  ON timetable_entries (school_id, day_of_week, period_id);
