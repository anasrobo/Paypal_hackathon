/**
 * Every SQL statement in the application.
 *
 * One module, so the database surface is auditable in one place, and so the
 * raw-SQL convention is easy to follow. Each function takes a `Sql` so it can
 * run either on the shared pool or inside a transaction.
 *
 * The state-changing statements are COMPARE AND SWAPS:
 *
 *   UPDATE bounties SET status = $to WHERE id = $id AND status = $from
 *
 * If the current status is not what the caller expected, zero rows change and
 * the caller knows the world moved underneath it. That is how two concurrent
 * requests cannot both advance the same bounty.
 */

import type { Sql } from "./client";
import type {
  AuditEventRow,
  BountyRow,
  EvidenceRow,
  PayoutRow,
  PayoutStatus,
  VerificationCheckRow,
} from "./types";

/**
 * The columns of a bounty, as the application sees them.
 *
 * The `_lon` columns are ALIASED to `_lng`. The physical column names come
 * from the data model, but the whole application — the domain, the gate, the
 * capture screen — speaks `lng`. Without the alias the camel-case transform
 * would hand back `storeLon` and every read of `storeLng` would be
 * `undefined`, which silently fails the geofence rule for every bounty.
 *
 * This alias is load-bearing. Do not remove it without renaming the columns.
 */
const BOUNTY_COLUMNS = `
  id, status, sku, store_name, store_address, store_lat, store_lon AS store_lng, radius_m,
  expected_value_cents, tolerance_pct, currency, reward_cents, requester_email,
  claim_token_hash, claimed_by_email, claimed_at, submitted_at, expires_at,
  evidence_path, evidence_thumb_path, evidence_bytes, evidence_mime,
  evidence_sha256, captured_at, capture_lat, capture_lon AS capture_lng, capture_accuracy_m,
  model_verdict, model_confidence, model_observed_cents, model_raw,
  model_provider, model_latency_ms, mock_scenario, created_at, updated_at
`;

// ------------------------------------------------------------------ bounties

export async function insertBounty(
  sql: Sql,
  input: {
    id: string;
    sku: string;
    storeName: string;
    storeAddress: string;
    storeLat: number;
    storeLng: number;
    radiusM: number;
    expectedValueCents: number;
    tolerancePct: number;
    currency: string;
    rewardCents: number;
    requesterEmail: string;
    claimTokenHash: string;
    expiresAt: Date;
    mockScenario: string | null;
  },
): Promise<BountyRow> {
  const [row] = await sql<BountyRow[]>`
    INSERT INTO bounties (
      id, sku, store_name, store_address, store_lat, store_lon, radius_m,
      expected_value_cents, tolerance_pct, currency, reward_cents,
      requester_email, claim_token_hash, expires_at, mock_scenario
    ) VALUES (
      ${input.id}, ${input.sku}, ${input.storeName}, ${input.storeAddress},
      ${input.storeLat}, ${input.storeLng}, ${input.radiusM},
      ${input.expectedValueCents}, ${input.tolerancePct}, ${input.currency},
      ${input.rewardCents}, ${input.requesterEmail}, ${input.claimTokenHash},
      ${input.expiresAt}, ${input.mockScenario}
    )
    RETURNING ${sql.unsafe(BOUNTY_COLUMNS)}
  `;
  return row;
}

export async function getBountyById(sql: Sql, id: string): Promise<BountyRow | null> {
  const [row] = await sql<BountyRow[]>`
    SELECT ${sql.unsafe(BOUNTY_COLUMNS)} FROM bounties WHERE id = ${id}
  `;
  return row ?? null;
}

/**
 * The compare-and-swap. Returns null when the status was not what the
 * caller expected, which means somebody else moved the bounty first.
 */
export async function transitionBounty(
  sql: Sql,
  id: string,
  from: string,
  to: string,
): Promise<BountyRow | null> {
  const [row] = await sql<BountyRow[]>`
    UPDATE bounties SET status = ${to}
    WHERE id = ${id} AND status = ${from}
    RETURNING ${sql.unsafe(BOUNTY_COLUMNS)}
  `;
  return row ?? null;
}

/** Update the mutable fields of a bounty without touching its status. */
export async function updateBounty(
  sql: Sql,
  id: string,
  patch: Partial<{
    claimedByEmail: string;
    claimedAt: Date;
    submittedAt: Date;
    evidencePath: string;
    evidenceThumbPath: string;
    evidenceBytes: number;
    evidenceMime: string;
    evidenceSha256: string;
    capturedAt: Date;
    captureLat: number;
    captureLng: number;
    captureAccuracyM: number;
    modelVerdict: string;
    modelConfidence: number;
    modelObservedCents: number;
    modelRaw: unknown;
    modelProvider: string;
    modelLatencyMs: number;
  }>,
): Promise<BountyRow | null> {
  const [row] = await sql<BountyRow[]>`
    UPDATE bounties SET
      claimed_by_email = COALESCE(${patch.claimedByEmail ?? null}, claimed_by_email),
      claimed_at = COALESCE(${patch.claimedAt ?? null}, claimed_at),
      submitted_at = COALESCE(${patch.submittedAt ?? null}, submitted_at),
      evidence_path = COALESCE(${patch.evidencePath ?? null}, evidence_path),
      evidence_thumb_path = COALESCE(${patch.evidenceThumbPath ?? null}, evidence_thumb_path),
      evidence_bytes = COALESCE(${patch.evidenceBytes ?? null}, evidence_bytes),
      evidence_mime = COALESCE(${patch.evidenceMime ?? null}, evidence_mime),
      evidence_sha256 = COALESCE(${patch.evidenceSha256 ?? null}, evidence_sha256),
      captured_at = COALESCE(${patch.capturedAt ?? null}, captured_at),
      capture_lat = COALESCE(${patch.captureLat ?? null}, capture_lat),
      capture_lon = COALESCE(${patch.captureLng ?? null}, capture_lon),
      capture_accuracy_m = COALESCE(${patch.captureAccuracyM ?? null}, capture_accuracy_m),
      model_verdict = COALESCE(${patch.modelVerdict ?? null}, model_verdict),
      model_confidence = COALESCE(${patch.modelConfidence ?? null}, model_confidence),
      model_observed_cents = COALESCE(${patch.modelObservedCents ?? null}, model_observed_cents),
      model_provider = COALESCE(${patch.modelProvider ?? null}, model_provider),
      model_latency_ms = COALESCE(${patch.modelLatencyMs ?? null}, model_latency_ms)
    WHERE id = ${id}
    RETURNING ${sql.unsafe(BOUNTY_COLUMNS)}
  `;

  // model_raw is jsonb, so it needs a JSON fragment rather than a plain
  // parameter, and it is only written when there is something to write.
  if (patch.modelRaw !== undefined) {
    await sql`
      UPDATE bounties SET model_raw = ${sql.json(patch.modelRaw as never)}
      WHERE id = ${id}
    `;
  }

  return row ?? null;
}

export async function listBounties(sql: Sql, limit = 100): Promise<BountyRow[]> {
  return sql<BountyRow[]>`
    SELECT ${sql.unsafe(BOUNTY_COLUMNS)}
    FROM bounties
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export interface BountyKpis {
  total: number;
  inFlight: number;
  paid: number;
  failed: number;
  posted: number;
  paidCents: number;
}

/**
 * The headline numbers for the requester console.
 *
 * One query, computed in the database, so the console never has to pull every
 * row to count them. The statuses are grouped by what they MEAN: money that
 * moved, money that is moving, money that was refused.
 */
export async function getBountyKpis(sql: Sql): Promise<BountyKpis> {
  // The connection transforms every column name to camel case, so the row's
  // keys are `inFlight` and `paidCents` — NOT `in_flight` and `paid_cents`.
  //
  // Reading the snake_case name returns `undefined`, and
  // `Number(undefined ?? 0)` is a very convincing zero. That bug shipped once:
  // the console showed "18 paid" next to "$0.00 paid out". The types below
  // are written in camel case on purpose, so the compiler agrees with the
  // runtime.
  const [row] = await sql<
    {
      total: number;
      inFlight: number;
      paid: number;
      failed: number;
      posted: number;
      paidCents: number;
    }[]
  >`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE status IN ('POSTED', 'CLAIMED', 'SUBMITTED', 'VERIFYING', 'PAYING')
      )::int AS in_flight,
      COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid,
      COUNT(*) FILTER (
        WHERE status IN ('REJECTED', 'PAYOUT_FAILED', 'PAYOUT_BLOCKED')
      )::int AS failed,
      COUNT(*) FILTER (WHERE status = 'POSTED')::int AS posted,
      COALESCE(SUM(reward_cents) FILTER (WHERE status = 'PAID'), 0)::int AS paid_cents
    FROM bounties
  `;

  return {
    total: Number(row?.total ?? 0),
    inFlight: Number(row?.inFlight ?? 0),
    paid: Number(row?.paid ?? 0),
    failed: Number(row?.failed ?? 0),
    posted: Number(row?.posted ?? 0),
    paidCents: Number(row?.paidCents ?? 0),
  };
}

// ------------------------------------------------------------------ evidence

export async function insertEvidence(
  sql: Sql,
  input: {
    bountyId: string;
    mediaPath: string;
    thumbPath: string | null;
    bytes: number;
    mime: string;
    sha256: string | null;
    capturedAt: Date;
    lat: number | null;
    lon: number | null;
    accuracyM: number | null;
  },
): Promise<EvidenceRow> {
  const [row] = await sql<EvidenceRow[]>`
    INSERT INTO evidence (
      bounty_id, media_path, thumb_path, bytes, mime, sha256,
      captured_at, lat, lon, accuracy_m
    ) VALUES (
      ${input.bountyId}, ${input.mediaPath}, ${input.thumbPath}, ${input.bytes},
      ${input.mime}, ${input.sha256}, ${input.capturedAt}, ${input.lat},
      ${input.lon}, ${input.accuracyM}
    )
    RETURNING *
  `;
  return row;
}

export async function getEvidenceByBountyId(
  sql: Sql,
  bountyId: string,
): Promise<EvidenceRow | null> {
  const [row] = await sql<EvidenceRow[]>`
    SELECT * FROM evidence WHERE bounty_id = ${bountyId}
  `;
  return row ?? null;
}

// -------------------------------------------------------- verification checks

export async function replaceVerificationChecks(
  sql: Sql,
  bountyId: string,
  checks: { ruleKey: string; passed: boolean; observed: unknown; expected: unknown }[],
): Promise<void> {
  if (checks.length === 0) return;
  for (const check of checks) {
    await sql`
      INSERT INTO verification_checks (bounty_id, rule_key, passed, observed, expected)
      VALUES (
        ${bountyId}, ${check.ruleKey}, ${check.passed},
        ${sql.json(check.observed as never)}, ${sql.json(check.expected as never)}
      )
      ON CONFLICT (bounty_id, rule_key)
      DO UPDATE SET passed = EXCLUDED.passed,
                    observed = EXCLUDED.observed,
                    expected = EXCLUDED.expected
    `;
  }
}

export async function getVerificationChecks(
  sql: Sql,
  bountyId: string,
): Promise<VerificationCheckRow[]> {
  return sql<VerificationCheckRow[]>`
    SELECT * FROM verification_checks
    WHERE bounty_id = ${bountyId}
    ORDER BY id ASC
  `;
}

// ------------------------------------------------------------------- payouts

/**
 * Insert the payout row. This happens BEFORE the PayPal call.
 *
 * `ON CONFLICT (bounty_id) DO NOTHING` returns zero rows when a payout for
 * this bounty already exists. That is the exactly-once gate: a duplicate
 * attempt never reaches PayPal.
 */
export async function insertPayout(
  sql: Sql,
  input: {
    bountyId: string;
    senderBatchId: string;
    amountCents: number;
    currency: string;
    payeeEmail: string;
    provider: string;
  },
): Promise<PayoutRow | null> {
  const [row] = await sql<PayoutRow[]>`
    INSERT INTO payouts (
      bounty_id, sender_batch_id, status, amount_cents, currency,
      payee_email, provider
    ) VALUES (
      ${input.bountyId}, ${input.senderBatchId}, 'CREATED', ${input.amountCents},
      ${input.currency}, ${input.payeeEmail}, ${input.provider}
    )
    ON CONFLICT (bounty_id) DO NOTHING
    RETURNING *
  `;
  return row ?? null;
}

export async function getPayoutByBountyId(
  sql: Sql,
  bountyId: string,
): Promise<PayoutRow | null> {
  const [row] = await sql<PayoutRow[]>`
    SELECT * FROM payouts WHERE bounty_id = ${bountyId}
  `;
  return row ?? null;
}

export async function getPayoutBySenderBatchId(
  sql: Sql,
  senderBatchId: string,
): Promise<PayoutRow | null> {
  const [row] = await sql<PayoutRow[]>`
    SELECT * FROM payouts WHERE sender_batch_id = ${senderBatchId}
  `;
  return row ?? null;
}

export async function getPayoutByExternalId(
  sql: Sql,
  externalId: string,
): Promise<PayoutRow | null> {
  const [row] = await sql<PayoutRow[]>`
    SELECT * FROM payouts WHERE external_id = ${externalId}
  `;
  return row ?? null;
}

/**
 * Move a payout from CREATED to SUBMITTED.
 *
 * A compare-and-swap on purpose: the webhook can arrive BEFORE this call
 * finishes, because the mock provider delivers it inside createPayout. A
 * plain update would overwrite the PAID status the webhook just set.
 */
export async function markPayoutSubmitted(
  sql: Sql,
  id: string,
  externalId: string,
): Promise<boolean> {
  const rows = await sql`
    UPDATE payouts SET status = 'SUBMITTED', external_id = ${externalId}
    WHERE id = ${id} AND status = 'CREATED'
  `;
  return rows.count > 0;
}

export async function updatePayout(
  sql: Sql,
  id: string,
  patch: Partial<{
    status: PayoutStatus;
    externalId: string;
    errorCode: string;
    errorMessage: string;
    paidAt: Date;
  }>,
): Promise<PayoutRow | null> {
  const [row] = await sql<PayoutRow[]>`
    UPDATE payouts SET
      status = COALESCE(${patch.status ?? null}, status),
      external_id = COALESCE(${patch.externalId ?? null}, external_id),
      error_code = COALESCE(${patch.errorCode ?? null}, error_code),
      error_message = COALESCE(${patch.errorMessage ?? null}, error_message),
      paid_at = COALESCE(${patch.paidAt ?? null}, paid_at)
    WHERE id = ${id}
    RETURNING *
  `;
  return row ?? null;
}

/** Payouts that are in flight and older than the cutoff. The reconciler. */
export async function listStuckPayouts(sql: Sql, olderThan: Date): Promise<PayoutRow[]> {
  return sql<PayoutRow[]>`
    SELECT p.*
    FROM payouts p
    JOIN bounties b ON b.id = p.bounty_id
    WHERE b.status = 'PAYING' AND p.updated_at < ${olderThan}
    ORDER BY p.updated_at ASC
    LIMIT 50
  `;
}

// ------------------------------------------------------------- webhook events

/**
 * Insert the webhook event. Returns null when it is a REPLAY, because the
 * unique constraint on paypal_event_id rejected it.
 */
export async function insertWebhookEvent(
  sql: Sql,
  input: { paypalEventId: string; eventType: string; resourceId: string | null; payload: unknown },
): Promise<number | null> {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO webhook_events (paypal_event_id, event_type, resource_id, payload)
    VALUES (
      ${input.paypalEventId}, ${input.eventType}, ${input.resourceId},
      ${sql.json(input.payload as never)}
    )
    ON CONFLICT (paypal_event_id) DO NOTHING
    RETURNING id
  `;
  return row?.id ?? null;
}

export async function markWebhookEvent(
  sql: Sql,
  id: number,
  outcome: string,
): Promise<void> {
  await sql`
    UPDATE webhook_events SET outcome = ${outcome}, processed_at = now()
    WHERE id = ${id}
  `;
}

// ----------------------------------------------------------------- audit log

export async function insertAuditEvent(
  sql: Sql,
  bountyId: string,
  type: string,
  payload: unknown = {},
): Promise<void> {
  await sql`
    INSERT INTO bounty_events (bounty_id, type, payload)
    VALUES (${bountyId}, ${type}, ${sql.json(payload as never)})
  `;
}

export async function listAuditEvents(sql: Sql, bountyId: string): Promise<AuditEventRow[]> {
  return sql<AuditEventRow[]>`
    SELECT * FROM bounty_events
    WHERE bounty_id = ${bountyId}
    ORDER BY created_at ASC, id ASC
  `;
}
