-- ============================================================
-- Seed Data — Development Only
-- EduNexus MVP seed: 1 school, all role users, sample classes
-- ============================================================
-- Run with: supabase db reset (includes seeds automatically)
-- Or manually: psql < supabase/seed/dev_seed.sql

-- ─── SCHOOL ─────────────────────────────────────────────────

INSERT INTO schools (id, name, code, address, city, state, phone, email, theme_color, academic_year_start_month)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Demo High School',
  'DHS001',
  '123 School Street',
  'Mumbai',
  'Maharashtra',
  '+91 98765 43210',
  'admin@demohighschool.edu',
  '#3B82F6',
  4
);

-- ─── ACADEMIC YEAR ──────────────────────────────────────────

INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_current)
VALUES (
  '00000000-0000-0000-0000-000000000010'::UUID,
  '00000000-0000-0000-0000-000000000001'::UUID,
  '2025-26',
  '2025-04-01',
  '2026-03-31',
  TRUE
);

-- ─── CLASSES ────────────────────────────────────────────────

INSERT INTO classes (id, school_id, name, display_order) VALUES
  ('00000000-0000-0000-0001-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Class 1', 1),
  ('00000000-0000-0000-0001-000000000002'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Class 2', 2),
  ('00000000-0000-0000-0001-000000000003'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Class 3', 3),
  ('00000000-0000-0000-0001-000000000010'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Class 10', 10);

-- ─── SECTIONS ───────────────────────────────────────────────

INSERT INTO sections (id, school_id, class_id, name, capacity) VALUES
  ('00000000-0000-0000-0002-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0001-000000000001'::UUID, 'A', 40),
  ('00000000-0000-0000-0002-000000000002'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0001-000000000001'::UUID, 'B', 40),
  ('00000000-0000-0000-0002-000000000010'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0001-000000000010'::UUID, 'A', 35);

-- ─── FEE CATEGORIES ─────────────────────────────────────────

INSERT INTO fee_categories (id, school_id, name, description) VALUES
  ('00000000-0000-0000-0003-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Tuition Fee', 'Monthly tuition fees'),
  ('00000000-0000-0000-0003-000000000002'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Transport Fee', 'School bus charges'),
  ('00000000-0000-0000-0003-000000000003'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Library Fee', 'Annual library charges'),
  ('00000000-0000-0000-0003-000000000004'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'Sports Fee', 'Annual sports charges');

-- Note: Auth users and user_profiles are created via Supabase Auth
-- Use the Supabase Dashboard or CLI to create test users for each role.
-- See Documentation/DEVELOPMENT_PLAN.md for test credentials setup.
