-- Migration: 004
-- Version: 004
-- Description: The mock vision scenario.
--
-- The vision provider is a deterministic mock until a real API key arrives.
-- A mock that always says "match" makes the demo world boring and hides the
-- rejection path; a mock that decides randomly makes the demo unrepeatable.
--
-- So the scenario is explicit and stored on the bounty. It is read ONLY by
-- the mock provider. A real provider ignores it entirely.
--
-- Values:
--   match          the model read the expected price, with high confidence
--   mismatch       the model read a price outside the tolerance
--   low_confidence the model agrees but is not confident enough
--   unreadable     the model could not read the tag at all
-- ============================================================

ALTER TABLE bounties ADD COLUMN IF NOT EXISTS mock_scenario text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bounties_mock_scenario_check'
  ) THEN
    ALTER TABLE bounties ADD CONSTRAINT bounties_mock_scenario_check
      CHECK (mock_scenario IS NULL OR mock_scenario IN (
        'match', 'mismatch', 'low_confidence', 'unreadable'
      ));
  END IF;
END
$$;

COMMENT ON COLUMN bounties.mock_scenario IS
  'Demo affordance for the mock vision provider only. Ignored by a real provider.';
