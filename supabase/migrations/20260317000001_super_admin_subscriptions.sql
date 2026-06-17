-- ============================================================
-- Migration: 20260317000001_super_admin_subscriptions
-- EduNexus — Subscription columns on schools for Super Admin
--   platform administration (Module 11, Milestone 1).
-- Idempotent: safe to re-run.
-- ============================================================

-- ─── SUBSCRIPTION COLUMNS ───────────────────────────────────

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS subscription_plan   TEXT NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_ends_at       TIMESTAMPTZ;

-- ─── VALUE CONSTRAINTS ──────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_subscription_plan_check'
  ) THEN
    ALTER TABLE schools
      ADD CONSTRAINT schools_subscription_plan_check
      CHECK (subscription_plan IN ('basic', 'standard', 'premium'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_subscription_status_check'
  ) THEN
    ALTER TABLE schools
      ADD CONSTRAINT schools_subscription_status_check
      CHECK (subscription_status IN ('active', 'trial', 'suspended'));
  END IF;
END $$;

-- ─── INDEX (dashboard aggregation by status) ────────────────

CREATE INDEX IF NOT EXISTS idx_schools_subscription_status
  ON schools (subscription_status);

-- Existing rows already default to plan='basic', status='active' via the
-- column defaults above; no backfill required.
