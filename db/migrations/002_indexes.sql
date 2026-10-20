-- Migration: 002
-- Version: 002
-- Description: Indexes for the ops ledger, the bounty lookups and the 60-second
--              reconciler sweep.
-- ============================================================

-- The ledger sorts newest first and pages with a keyset cursor.
CREATE INDEX IF NOT EXISTS bounties_ledger_created_idx
  ON bounties (created_at DESC, id DESC);

-- The console filters by status.
CREATE INDEX IF NOT EXISTS bounties_status_created_idx
  ON bounties (status, created_at DESC);

-- The ops ledger filters by verdict. Partial, because most rows have no verdict.
CREATE INDEX IF NOT EXISTS bounties_verdict_created_idx
  ON bounties (model_verdict, created_at DESC)
  WHERE model_verdict IS NOT NULL;

-- The console filters by requester.
CREATE INDEX IF NOT EXISTS bounties_requester_idx
  ON bounties (requester_email, created_at DESC);

-- The ops ledger filters by SKU.
CREATE INDEX IF NOT EXISTS bounties_sku_idx
  ON bounties (sku);

CREATE INDEX IF NOT EXISTS bounties_sku_status_idx
  ON bounties (sku, status);

-- THE RECONCILER. A partial index over the rows that are actually in flight,
-- so the 60-second sweep touches almost nothing.
CREATE INDEX IF NOT EXISTS bounties_paying_idx
  ON bounties (updated_at)
  WHERE status = 'PAYING';

-- The evidence checklist is one query, not six.
CREATE INDEX IF NOT EXISTS verification_checks_bounty_idx
  ON verification_checks (bounty_id, rule_key);

-- Webhook ingestion and the idempotency lookup.
CREATE INDEX IF NOT EXISTS webhook_events_received_idx
  ON webhook_events (received_at DESC);

-- The payout ledger.
CREATE INDEX IF NOT EXISTS payouts_status_created_idx
  ON payouts (status, created_at DESC);

-- The audit trail reads newest first per bounty.
CREATE INDEX IF NOT EXISTS bounty_events_bounty_idx
  ON bounty_events (bounty_id, created_at DESC);

-- The evidence page loads by bounty.
CREATE INDEX IF NOT EXISTS evidence_bounty_idx
  ON evidence (bounty_id);
