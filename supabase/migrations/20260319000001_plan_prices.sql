-- Plan price configuration for the Super Admin platform.
-- Replaces hard-coded code constants with an editable, audited source of truth.
-- Revenue calculations read from this table (falling back to code defaults if a
-- row is missing).

CREATE TABLE IF NOT EXISTS plan_prices (
  plan        text PRIMARY KEY CHECK (plan IN ('basic', 'standard', 'premium')),
  price_inr   integer NOT NULL CHECK (price_inr >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

-- Seed with the current code-constant defaults (idempotent).
INSERT INTO plan_prices (plan, price_inr) VALUES
  ('basic', 2000),
  ('standard', 5000),
  ('premium', 10000)
ON CONFLICT (plan) DO NOTHING;

ALTER TABLE plan_prices ENABLE ROW LEVEL SECURITY;

-- Super admins manage prices; everyone authenticated may read them.
DROP POLICY IF EXISTS super_admin_all_plan_prices ON plan_prices;
CREATE POLICY super_admin_all_plan_prices ON plan_prices
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS authenticated_read_plan_prices ON plan_prices;
CREATE POLICY authenticated_read_plan_prices ON plan_prices
  FOR SELECT
  USING (auth.role() = 'authenticated');
