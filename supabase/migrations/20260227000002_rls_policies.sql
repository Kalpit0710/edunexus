-- ============================================================
-- Migration: 20260227000002_rls_policies
-- EduNexus — Row Level Security policies for all tables
-- ============================================================

-- ─── ENABLE RLS ─────────────────────────────────────────────

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_section_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payment_items ENABLE ROW LEVEL SECURITY;

-- ─── HELPER FUNCTIONS ───────────────────────────────────────

-- Get current user's school_id from user_profiles
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT school_id FROM user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE auth_user_id = auth.uid()
    AND role = 'super_admin'
  );
$$;

-- Check if current user is school admin
CREATE OR REPLACE FUNCTION is_school_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE auth_user_id = auth.uid()
    AND role = 'school_admin'
  );
$$;

-- Check if current user has admin or manager role
CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE auth_user_id = auth.uid()
    AND role IN ('school_admin', 'manager', 'cashier')
  );
$$;

-- ─── SCHOOLS POLICIES ───────────────────────────────────────

-- Super admin: full access to all schools
CREATE POLICY "super_admin_all_schools" ON schools
  FOR ALL TO authenticated
  USING (is_super_admin());

-- School staff: read own school only
CREATE POLICY "school_staff_read_own_school" ON schools
  FOR SELECT TO authenticated
  USING (id = get_my_school_id());

-- ─── USER PROFILES POLICIES ─────────────────────────────────

-- Super admin: full access
CREATE POLICY "super_admin_all_profiles" ON user_profiles
  FOR ALL TO authenticated
  USING (is_super_admin());

-- School admin: manage their school's profiles
CREATE POLICY "school_admin_manage_profiles" ON user_profiles
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin());

-- Staff: read own profile + school colleagues
CREATE POLICY "staff_read_school_profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

-- Any user: can update their own profile
CREATE POLICY "user_update_own_profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid());

-- ─── CLASSES & SECTIONS POLICIES ────────────────────────────

CREATE POLICY "school_members_read_classes" ON classes
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "school_admin_manage_classes" ON classes
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin());

CREATE POLICY "school_members_read_sections" ON sections
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "school_admin_manage_sections" ON sections
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin());

-- ─── SUBJECTS POLICIES ──────────────────────────────────────

CREATE POLICY "school_members_read_subjects" ON subjects
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "school_admin_manage_subjects" ON subjects
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin());

-- ─── STUDENTS POLICIES ──────────────────────────────────────

-- Staff: read all active students in their school
CREATE POLICY "school_staff_read_students" ON students
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND deleted_at IS NULL);

-- School admin: full CRUD on students
CREATE POLICY "school_admin_manage_students" ON students
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin());

-- ─── TEACHERS POLICIES ──────────────────────────────────────

CREATE POLICY "school_staff_read_teachers" ON teachers
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "school_admin_manage_teachers" ON teachers
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin());

-- ─── ATTENDANCE POLICIES ────────────────────────────────────

-- Staff: read attendance for their school
CREATE POLICY "school_staff_read_attendance" ON attendance_records
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

-- Teachers and admins: insert/update attendance
CREATE POLICY "school_staff_mark_attendance" ON attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id());

CREATE POLICY "school_staff_edit_attendance" ON attendance_records
  FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id());

-- ─── FEE POLICIES ───────────────────────────────────────────

CREATE POLICY "school_staff_read_fee_categories" ON fee_categories
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "school_admin_manage_fee_categories" ON fee_categories
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin());

CREATE POLICY "school_staff_read_fee_structures" ON fee_structures
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "school_admin_manage_fee_structures" ON fee_structures
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin());

CREATE POLICY "cashier_read_payments" ON fee_payments
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager());

CREATE POLICY "cashier_insert_payment" ON fee_payments
  FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

CREATE POLICY "cashier_read_payment_items" ON fee_payment_items
  FOR SELECT TO authenticated
  USING (
    payment_id IN (
      SELECT id FROM fee_payments WHERE school_id = get_my_school_id()
    )
  );
