-- ─────────────────────────────────────────────────────────────────────────────
-- Allow managers (and cashiers) to manage student records at the RLS layer.
--
-- Mirrors how fee collection is authorized (`is_admin_or_manager()` on
-- fee_payments): this policy only sets the coarse role-family boundary. Precise
-- capability gating (create vs edit vs delete) stays in the server actions via
-- requirePermission('students.create' | 'students.edit' | 'students.delete') —
-- e.g. cashiers can view students but lack students.edit, so their writes are
-- rejected in the action layer even though this policy would permit them.
--
-- Unions with the existing "school_admin_manage_students" policy (policies are
-- OR-ed), so School Admin access is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "manager_manage_students" ON students;

CREATE POLICY "manager_manage_students" ON students
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());
