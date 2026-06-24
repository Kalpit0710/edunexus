-- ─────────────────────────────────────────────────────────────────────────────
-- School customization — Phase 3 (access control)
--
--  • schools.disabled_features — admin-disabled modules (subtractive overlay on
--    plan entitlements). Empty = nothing disabled.
--  • role_permissions — per-school, per-role capability overrides. Absence of a
--    row means "use the built-in default for that role", so existing schools are
--    unaffected until an admin tightens something.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS disabled_features TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN schools.disabled_features IS 'Feature keys the school admin has switched off (overrides plan entitlements).';

CREATE TABLE IF NOT EXISTS role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  permission  TEXT NOT NULL,
  allowed     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, role, permission)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_permissions_super ON role_permissions;
CREATE POLICY role_permissions_super ON role_permissions
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Any member of the school may read its permission matrix (needed so the client
-- can compute its own effective capabilities at sign-in).
DROP POLICY IF EXISTS role_permissions_read ON role_permissions;
CREATE POLICY role_permissions_read ON role_permissions
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

DROP POLICY IF EXISTS role_permissions_write ON role_permissions;
CREATE POLICY role_permissions_write ON role_permissions
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());
