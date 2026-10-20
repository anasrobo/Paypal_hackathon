-- Migration: 003
-- Version: 003
-- Description: Row Level Security.
--
-- Every table is service-role only. RLS is enabled and no policies are
-- created, so the anon and authenticated roles are denied by default, and
-- the grants to those roles are revoked outright. The application reaches
-- Postgres only through the server-side client, which uses the service role.
--
-- This mirrors the pattern in the user's existing production project, where
-- migration 016 dropped the write policies on the payment tables and revoked
-- the grants: RLS is the safety net for anything that reaches PostgREST with
-- the public anon key.
--
-- The `anon`, `authenticated` and `service_role` roles are Supabase
-- conventions and do not exist in a plain Postgres. The role work is
-- therefore wrapped in a DO block that only runs when the role is present,
-- so this migration applies cleanly to both the local embedded Postgres and
-- the Supabase project.
-- ============================================================

ALTER TABLE bounties            ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounty_events       ENABLE ROW LEVEL SECURITY;

-- No policies are created for any of these tables. Deny by default.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bounties', 'evidence', 'payouts',
    'verification_checks', 'webhook_events', 'bounty_events'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON %I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON %I FROM authenticated', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT ALL ON %I TO service_role', t);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE verification_checks_id_seq TO service_role';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE webhook_events_id_seq TO service_role';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE bounty_events_id_seq TO service_role';
  END IF;
END
$$;
