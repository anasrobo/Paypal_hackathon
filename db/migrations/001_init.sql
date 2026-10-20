-- Migration: 001
-- Version: 001
-- Description: Core schema — bounties, evidence, payouts, verification checks,
--              webhook events, audit trail, and the status transition guard.
-- ============================================================
-- GroundTruth uses a NEW, ISOLATED Supabase project. Nothing here touches the
-- DataCleanist project, which carries live payment tables.
-- ============================================================

-- ---------------------------------------------------------------- bounties
CREATE TABLE IF NOT EXISTS bounties (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status                text NOT NULL DEFAULT 'POSTED',
  sku                   text NOT NULL,
  store_name            text NOT NULL,
  store_address         text NOT NULL,
  store_lat             double precision NOT NULL,
  store_lon             double precision NOT NULL,
  radius_m              integer NOT NULL DEFAULT 250,
  expected_value_cents  integer NOT NULL CHECK (expected_value_cents > 0),
  tolerance_pct         integer NOT NULL DEFAULT 10 CHECK (tolerance_pct >= 0),
  currency              text NOT NULL DEFAULT 'USD',
  reward_cents          integer NOT NULL CHECK (reward_cents > 0 AND reward_cents <= 100000),
  requester_email       text NOT NULL,
  claim_token_hash      text UNIQUE,
  claimed_by_email      text,
  claimed_at            timestamptz,
  submitted_at          timestamptz,
  expires_at            timestamptz NOT NULL,
  evidence_path         text,
  evidence_thumb_path   text,
  evidence_bytes        integer,
  evidence_mime         text,
  evidence_sha256       text,
  captured_at           timestamptz,
  capture_lat           double precision,
  capture_lon           double precision,
  capture_accuracy_m    integer,
  model_verdict         text,
  model_confidence      numeric(4,3),
  model_observed_cents  integer,
  model_raw             jsonb,
  model_provider        text,
  model_latency_ms      integer,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bounties_status_check CHECK (status IN (
    'POSTED','CLAIMED','SUBMITTED','VERIFYING','VERIFIED','REJECTED',
    'PAYING','PAID','PAYOUT_FAILED','PAYOUT_BLOCKED','EXPIRED','CANCELLED'
  ))
);

COMMENT ON TABLE  bounties IS 'A verification bounty. The aggregate root of the product.';
COMMENT ON COLUMN bounties.status IS 'The 12-state lifecycle. Guarded by a trigger.';
COMMENT ON COLUMN bounties.reward_cents IS 'What the human is paid. Always read from this row, never from a request.';
COMMENT ON COLUMN bounties.claim_token_hash IS 'SHA-256 of the claim token. The raw token is never stored.';

-- ---------------------------------------------------------------- evidence
CREATE TABLE IF NOT EXISTS evidence (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id    uuid NOT NULL UNIQUE REFERENCES bounties(id) ON DELETE CASCADE,
  media_path   text NOT NULL,
  thumb_path   text,
  bytes        integer NOT NULL,
  mime         text NOT NULL,
  sha256       text,
  captured_at  timestamptz NOT NULL,
  lat          double precision,
  lon          double precision,
  accuracy_m   integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE evidence IS 'One submission of evidence per bounty. The UNIQUE on bounty_id makes resubmission impossible.';

-- ----------------------------------------------------------------- payouts
-- THE MONEY TABLE.
CREATE TABLE IF NOT EXISTS payouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id        uuid NOT NULL UNIQUE REFERENCES bounties(id) ON DELETE CASCADE,
  sender_batch_id  text NOT NULL UNIQUE,
  status           text NOT NULL DEFAULT 'CREATED',
  amount_cents     integer NOT NULL CHECK (amount_cents > 0),
  currency         text NOT NULL DEFAULT 'USD',
  payee_email      text NOT NULL,
  provider         text NOT NULL,
  external_id      text,
  error_code       text,
  error_message    text,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payouts_status_check CHECK (status IN
    ('CREATED','SUBMITTED','PAID','FAILED','BLOCKED','UNKNOWN'))
);

COMMENT ON TABLE  payouts IS 'A payout attempt. UNIQUE(bounty_id) is the one-payout-per-bounty gate.';
COMMENT ON COLUMN payouts.sender_batch_id IS 'Deterministic PayPal idempotency key: gt-bounty-{id}-v1. Never random.';

-- ------------------------------------------------------- verification_checks
CREATE TABLE IF NOT EXISTS verification_checks (
  id          bigserial PRIMARY KEY,
  bounty_id   uuid NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
  rule_key    text NOT NULL,
  passed      boolean NOT NULL,
  observed    jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected    jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity    text NOT NULL DEFAULT 'BLOCKING',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bounty_id, rule_key),
  CONSTRAINT verification_checks_severity_check CHECK (severity IN ('BLOCKING','ADVISORY'))
);

COMMENT ON TABLE verification_checks IS 'One row per rule. The UNIQUE makes the evidence checklist a single query instead of six.';

-- ----------------------------------------------------------- webhook_events
CREATE TABLE IF NOT EXISTS webhook_events (
  id               bigserial PRIMARY KEY,
  paypal_event_id  text NOT NULL UNIQUE,
  event_type       text NOT NULL,
  resource_id      text,
  payload          jsonb NOT NULL,
  outcome          text,
  received_at      timestamptz NOT NULL DEFAULT now(),
  processed_at     timestamptz
);

COMMENT ON TABLE webhook_events IS 'Insert-first idempotency ledger. A replayed event inserts zero rows and is a no-op.';

-- ------------------------------------------------------------ bounty_events
CREATE TABLE IF NOT EXISTS bounty_events (
  id          bigserial PRIMARY KEY,
  bounty_id   uuid NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
  type        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bounty_events IS 'Append-only audit trail. Rows are never updated or deleted.';

-- ============================================================
-- The status transition guard.
--
-- The application enforces the lifecycle with a compare-and-swap UPDATE.
-- The database enforces it again, here. Two independent layers means a
-- future code path that forgets to check still cannot produce an illegal
-- transition.
--
-- The table mirrors src/domain/state-machine.ts. The application additionally
-- distinguishes an automatic transition from an operator retry; the
-- database only enforces the legal graph.
-- ============================================================

CREATE TABLE IF NOT EXISTS bounty_state_transition (
  from_status  text NOT NULL,
  to_status    text NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

INSERT INTO bounty_state_transition (from_status, to_status) VALUES
  ('POSTED',          'CLAIMED'),
  ('POSTED',          'EXPIRED'),
  ('POSTED',          'CANCELLED'),
  ('CLAIMED',         'SUBMITTED'),
  ('CLAIMED',         'EXPIRED'),
  ('CLAIMED',         'CANCELLED'),
  ('SUBMITTED',       'VERIFYING'),
  ('VERIFYING',       'VERIFIED'),
  ('VERIFYING',       'REJECTED'),
  ('VERIFIED',        'PAYING'),
  ('PAYING',          'PAID'),
  ('PAYING',          'PAYOUT_FAILED'),
  ('PAYING',          'PAYOUT_BLOCKED'),
  ('PAYOUT_FAILED',   'PAYING'),
  ('PAYOUT_BLOCKED',  'PAYING')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION enforce_bounty_status_transition() RETURNS trigger AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM bounty_state_transition
    WHERE from_status = OLD.status AND to_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'illegal bounty status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bounties_status_guard ON bounties;
CREATE TRIGGER bounties_status_guard
  BEFORE UPDATE OF status ON bounties
  FOR EACH ROW EXECUTE FUNCTION enforce_bounty_status_transition();

-- updated_at is maintained by the database, not by the application.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bounties_touch_updated_at ON bounties;
CREATE TRIGGER bounties_touch_updated_at
  BEFORE UPDATE ON bounties
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS payouts_touch_updated_at ON payouts;
CREATE TRIGGER payouts_touch_updated_at
  BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
