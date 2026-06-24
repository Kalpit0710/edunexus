-- ─────────────────────────────────────────────────────────────────────────────
-- Report-card signatures + configurable fee lock
--
--  • schools.principal_signature_url — principal signature image shown on the
--    printed report card.
--  • schools.lock_results_on_fee — when TRUE, parents with outstanding fees are
--    blocked from viewing/printing report cards. Defaults to FALSE so existing
--    schools are unaffected (matches the documented "Result locked by fee" =
--    false default in module 01_school_configuration).
--  • teachers.signature_url — class-teacher signature image shown on the
--    printed report card.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS principal_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS lock_results_on_fee BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS signature_url TEXT;

COMMENT ON COLUMN schools.principal_signature_url IS 'Principal signature image URL printed on report cards.';
COMMENT ON COLUMN schools.lock_results_on_fee IS 'When true, parents with outstanding fees cannot view/print report cards.';
COMMENT ON COLUMN teachers.signature_url IS 'Class-teacher signature image URL printed on report cards.';
