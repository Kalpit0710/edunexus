-- ─────────────────────────────────────────────────────────────────────────────
-- School customization — Milestone 1
--
-- Gives each school control over report-card presentation, result vocabulary,
-- and locale/currency formatting. All columns are additive with sensible
-- defaults so existing schools are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS report_card_title    TEXT    NOT NULL DEFAULT 'Progress Report',
  ADD COLUMN IF NOT EXISTS pass_percentage      NUMERIC NOT NULL DEFAULT 33,
  ADD COLUMN IF NOT EXISTS result_statuses      TEXT[]  NOT NULL DEFAULT ARRAY['Passed','Failed','Promoted','Detained'],
  ADD COLUMN IF NOT EXISTS co_scholastic_grades TEXT[]  NOT NULL DEFAULT ARRAY['A','B','C','D','E'],
  ADD COLUMN IF NOT EXISTS currency_symbol      TEXT    NOT NULL DEFAULT '₹',
  ADD COLUMN IF NOT EXISTS locale               TEXT    NOT NULL DEFAULT 'en-IN',
  ADD COLUMN IF NOT EXISTS date_format          TEXT    NOT NULL DEFAULT 'dd MMM yyyy';

COMMENT ON COLUMN schools.report_card_title    IS 'Letterhead badge text on printed report cards (e.g. "Progress Report").';
COMMENT ON COLUMN schools.pass_percentage      IS 'Minimum overall percentage treated as a pass on report cards.';
COMMENT ON COLUMN schools.result_statuses      IS 'Selectable result-status options for report cards.';
COMMENT ON COLUMN schools.co_scholastic_grades IS 'Selectable co-scholastic grade values (e.g. A–E or A–C).';
COMMENT ON COLUMN schools.currency_symbol      IS 'Currency symbol used in fee displays.';
COMMENT ON COLUMN schools.locale               IS 'BCP-47 locale used for number/date formatting (e.g. en-IN).';
COMMENT ON COLUMN schools.date_format          IS 'Preferred human date format hint.';
