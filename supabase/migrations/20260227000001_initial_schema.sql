-- ============================================================
-- Migration: 20260227000001_initial_schema
-- EduNexus — Foundation tables for Phase 1 MVP
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ──────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'school_admin',
  'teacher',
  'manager',
  'cashier',
  'parent'
);

CREATE TYPE gender AS ENUM ('male', 'female', 'other');

CREATE TYPE attendance_status AS ENUM (
  'present',
  'absent',
  'late',
  'half_day',
  'holiday'
);

CREATE TYPE payment_mode AS ENUM (
  'cash',
  'cheque',
  'upi',
  'neft',
  'card',
  'online'
);

CREATE TYPE fee_status AS ENUM (
  'pending',
  'partial',
  'paid',
  'overdue',
  'waived'
);

-- ─── SCHOOLS ────────────────────────────────────────────────

CREATE TABLE schools (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                      TEXT NOT NULL,
  code                      TEXT NOT NULL UNIQUE,
  logo_url                  TEXT,
  address                   TEXT,
  city                      TEXT,
  state                     TEXT,
  pincode                   TEXT,
  phone                     TEXT,
  email                     TEXT,
  website                   TEXT,
  theme_color               TEXT DEFAULT '#3B82F6',
  academic_year_start_month INTEGER NOT NULL DEFAULT 4,   -- April
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── USER PROFILES ──────────────────────────────────────────

CREATE TABLE user_profiles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id      UUID REFERENCES schools(id) ON DELETE CASCADE,
  auth_user_id   UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  role           user_role NOT NULL,
  avatar_url     TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT school_required_for_non_super_admin
    CHECK (role = 'super_admin' OR school_id IS NOT NULL)
);

-- ─── ACADEMIC YEARS ─────────────────────────────────────────

CREATE TABLE academic_years (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,           -- e.g. "2025-26"
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name)
);

-- ─── CLASSES ────────────────────────────────────────────────

CREATE TABLE classes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,         -- e.g. "Class 1", "Grade 10"
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name)
);

-- ─── SECTIONS ───────────────────────────────────────────────

CREATE TABLE sections (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,           -- e.g. "A", "B", "Rose"
  capacity   INTEGER,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, class_id, name)
);

-- ─── SUBJECTS ───────────────────────────────────────────────

CREATE TABLE subjects (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  code       TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, class_id, name)
);

-- ─── STUDENTS ───────────────────────────────────────────────

CREATE TABLE students (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  admission_number  TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  date_of_birth     DATE,
  gender            gender,
  blood_group       TEXT,
  photo_url         TEXT,
  address           TEXT,
  class_id          UUID REFERENCES classes(id),
  section_id        UUID REFERENCES sections(id),
  roll_number       TEXT,
  admission_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at        TIMESTAMPTZ,      -- soft delete
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, admission_number)
);

-- ─── PARENTS ────────────────────────────────────────────────

CREATE TABLE parents (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  relation       TEXT NOT NULL DEFAULT 'parent',   -- father, mother, guardian
  phone          TEXT,
  email          TEXT,
  auth_user_id   UUID REFERENCES auth.users(id),   -- optional portal access
  is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TEACHERS ───────────────────────────────────────────────

CREATE TABLE teachers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_profile_id   UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  employee_id       TEXT,
  qualification     TEXT,
  specialization    TEXT,
  join_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, user_profile_id)
);

-- Teacher ↔ Section assignment
CREATE TABLE teacher_section_assignments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  section_id  UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id  UUID REFERENCES subjects(id),
  is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
  academic_year_id UUID REFERENCES academic_years(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, section_id, subject_id)
);

-- ─── ATTENDANCE ──────────────────────────────────────────────

CREATE TABLE attendance_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES classes(id),
  section_id  UUID NOT NULL REFERENCES sections(id),
  date        DATE NOT NULL,
  status      attendance_status NOT NULL DEFAULT 'present',
  remarks     TEXT,
  marked_by   UUID NOT NULL REFERENCES user_profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, student_id, date)
);

-- ─── FEE STRUCTURE ──────────────────────────────────────────

CREATE TABLE fee_categories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,          -- e.g. "Tuition", "Transport"
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name)
);

CREATE TABLE fee_structures (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES fee_categories(id),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  amount          DECIMAL(12, 2) NOT NULL,
  due_date        DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, class_id, category_id, academic_year_id)
);

-- ─── FEE PAYMENTS ───────────────────────────────────────────

CREATE TABLE fee_payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  receipt_number   TEXT NOT NULL,
  total_amount     DECIMAL(12, 2) NOT NULL,
  paid_amount      DECIMAL(12, 2) NOT NULL,
  discount_amount  DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_mode     payment_mode NOT NULL,
  payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  collected_by     UUID NOT NULL REFERENCES user_profiles(id),
  reference_number TEXT,
  remarks          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, receipt_number)
);

CREATE TABLE fee_payment_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id      UUID NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES fee_categories(id),
  amount          DECIMAL(12, 2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── INDEXES ────────────────────────────────────────────────

CREATE INDEX idx_user_profiles_school_id ON user_profiles(school_id);
CREATE INDEX idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_class_section ON students(class_id, section_id);
CREATE INDEX idx_students_active ON students(school_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_attendance_date ON attendance_records(school_id, date, section_id);
CREATE INDEX idx_attendance_student ON attendance_records(student_id, date);
CREATE INDEX idx_fee_payments_student ON fee_payments(student_id, payment_date);
CREATE INDEX idx_fee_payments_school ON fee_payments(school_id, payment_date);
