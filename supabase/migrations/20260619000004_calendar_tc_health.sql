-- ============================================================
-- Migration: 20260619000004_calendar_tc_health
-- EduNexus — Tier 1 / F1.5 Academic calendar, F1.6 Transfer
-- certificate, F1.7 Student health & allergy records.
-- ============================================================

-- ─── F1.7 · Student health / allergy fields ─────────────────
-- (blood_group already exists; add the safety-relevant columns
--  the student profile/edit UI expects.)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS allergies              TEXT,
  ADD COLUMN IF NOT EXISTS medical_conditions     TEXT,
  ADD COLUMN IF NOT EXISTS medications            TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS doctor_name            TEXT,
  ADD COLUMN IF NOT EXISTS doctor_phone           TEXT;

-- ─── F1.5 · Academic calendar / holidays ────────────────────
CREATE TABLE IF NOT EXISTS holidays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'holiday',   -- holiday | event | exam | break
  start_date  DATE NOT NULL,
  end_date    DATE,                              -- null = single day
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_school_date
  ON holidays (school_id, start_date);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS holidays_super ON holidays;
CREATE POLICY holidays_super ON holidays FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Anyone in the school (admin, teacher, parent) can read the calendar.
DROP POLICY IF EXISTS holidays_member_read ON holidays;
CREATE POLICY holidays_member_read ON holidays FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND deleted_at IS NULL);

-- Only admins / managers manage it.
DROP POLICY IF EXISTS holidays_admin_manage ON holidays;
CREATE POLICY holidays_admin_manage ON holidays FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

-- ─── F1.6 · Transfer certificates ───────────────────────────
CREATE TABLE IF NOT EXISTS transfer_certificates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  serial_no        INTEGER NOT NULL,                -- per-school monotonic counter
  tc_number        TEXT NOT NULL,                   -- e.g. TC/2026/0001
  issue_date       DATE NOT NULL DEFAULT current_date,
  leaving_date     DATE,
  reason           TEXT,
  conduct          TEXT,                            -- e.g. Good / Excellent
  remarks          TEXT,
  -- immutable snapshots so the certificate is stable even if the student record changes
  student_name     TEXT NOT NULL,
  admission_number TEXT,
  class_name       TEXT,
  date_of_birth    DATE,
  admission_date   DATE,
  issued_by        UUID,
  issued_by_name   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, serial_no),
  UNIQUE (school_id, tc_number)
);

CREATE INDEX IF NOT EXISTS idx_tc_student ON transfer_certificates (school_id, student_id);

ALTER TABLE transfer_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tc_super ON transfer_certificates;
CREATE POLICY tc_super ON transfer_certificates FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS tc_admin_manage ON transfer_certificates;
CREATE POLICY tc_admin_manage ON transfer_certificates FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

-- Atomic issuance: allocates the next per-school serial number, snapshots the
-- student, and (optionally) marks the student inactive (they have left).
CREATE OR REPLACE FUNCTION issue_transfer_certificate(
  p_school_id    UUID,
  p_student_id   UUID,
  p_issue_date   DATE,
  p_leaving_date DATE,
  p_reason       TEXT,
  p_conduct      TEXT,
  p_remarks      TEXT,
  p_deactivate   BOOLEAN
) RETURNS transfer_certificates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_student   students%ROWTYPE;
  v_seq       INTEGER;
  v_tc_number TEXT;
  v_class     TEXT;
  v_result    transfer_certificates;
BEGIN
  IF NOT (is_super_admin() OR (p_school_id = get_my_school_id() AND is_admin_or_manager())) THEN
    RAISE EXCEPTION 'Not authorized to issue transfer certificates' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_student FROM students WHERE id = p_student_id AND school_id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found in this school' USING ERRCODE = 'P0002';
  END IF;

  SELECT name INTO v_class FROM classes WHERE id = v_student.class_id;

  SELECT COALESCE(MAX(serial_no), 0) + 1 INTO v_seq
  FROM transfer_certificates WHERE school_id = p_school_id;

  v_tc_number := 'TC/' || to_char(COALESCE(p_issue_date, current_date), 'YYYY') || '/' || lpad(v_seq::text, 4, '0');

  INSERT INTO transfer_certificates (
    school_id, student_id, serial_no, tc_number, issue_date, leaving_date,
    reason, conduct, remarks, student_name, admission_number, class_name,
    date_of_birth, admission_date, issued_by, issued_by_name
  ) VALUES (
    p_school_id, p_student_id, v_seq, v_tc_number, COALESCE(p_issue_date, current_date), p_leaving_date,
    p_reason, p_conduct, p_remarks, v_student.full_name, v_student.admission_number, v_class,
    v_student.date_of_birth, v_student.admission_date, auth.uid(),
    (SELECT full_name FROM user_profiles WHERE auth_user_id = auth.uid())
  ) RETURNING * INTO v_result;

  IF p_deactivate THEN
    UPDATE students SET is_active = false, updated_at = now() WHERE id = p_student_id;
  END IF;

  RETURN v_result;
END; $$;
