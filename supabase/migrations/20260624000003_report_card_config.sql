-- ─────────────────────────────────────────────────────────────────────────────
-- School customization — Phase 2 (report-card structure)
--
--  • subjects.display_order — control the order subjects appear on report cards.
--  • schools.report_grand_total_rule — standard-tier grand-total = average of the
--    two terms ('average', default, current behaviour) or their sum ('sum').
--  • schools.scholastic_component_labels — per-school overrides for the standard
--    component labels (keyed by component key; empty = built-in labels).
--  • co_scholastic_areas — per-school configurable co-scholastic areas (replaces
--    the hard-coded Health/Art/Work trio; empty falls back to the defaults).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS report_grand_total_rule    TEXT  NOT NULL DEFAULT 'average',
  ADD COLUMN IF NOT EXISTS scholastic_component_labels JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN subjects.display_order IS 'Lower numbers appear first on report cards and marks entry.';
COMMENT ON COLUMN schools.report_grand_total_rule IS 'Standard-tier grand total: average (T1/2+T2/2) or sum (T1+T2).';
COMMENT ON COLUMN schools.scholastic_component_labels IS 'Per-school overrides for standard component labels, keyed by component key.';

-- ── Configurable co-scholastic areas ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS co_scholastic_areas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_co_scholastic_areas_school
  ON co_scholastic_areas (school_id)
  WHERE deleted_at IS NULL;

ALTER TABLE co_scholastic_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS co_scholastic_areas_super ON co_scholastic_areas;
CREATE POLICY co_scholastic_areas_super ON co_scholastic_areas
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS co_scholastic_areas_read ON co_scholastic_areas;
CREATE POLICY co_scholastic_areas_read ON co_scholastic_areas
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

DROP POLICY IF EXISTS co_scholastic_areas_write ON co_scholastic_areas;
CREATE POLICY co_scholastic_areas_write ON co_scholastic_areas
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());
