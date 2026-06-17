-- ============================================================
-- Migration: 20260318000001_audit_logs
-- EduNexus — Platform audit trail for Super Admin governance
--   (Module 11, Milestone 3). Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID REFERENCES schools(id) ON DELETE SET NULL, -- NULL = platform-level
  actor_id     UUID,                                           -- auth.users id of the actor
  actor_email  TEXT,
  actor_role   TEXT,
  action       TEXT NOT NULL,            -- e.g. school.created, user.deactivated
  entity_type  TEXT,                     -- school | user | subscription
  entity_id    UUID,
  entity_label TEXT,                     -- human-readable target (name)
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school     ON audit_logs (school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs (action);

-- ─── RLS ────────────────────────────────────────────────────

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Super admin: full visibility across the platform
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'super_admin_all_audit'
  ) THEN
    CREATE POLICY "super_admin_all_audit" ON audit_logs
      FOR ALL TO authenticated
      USING (is_super_admin());
  END IF;

  -- School admin: read their own school's audit entries
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'school_admin_read_audit'
  ) THEN
    CREATE POLICY "school_admin_read_audit" ON audit_logs
      FOR SELECT TO authenticated
      USING (school_id = get_my_school_id() AND is_school_admin());
  END IF;
END $$;

-- Writes happen via the service-role client in server actions, which bypasses RLS.
