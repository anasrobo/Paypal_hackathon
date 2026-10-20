/**
 * The seed.
 *
 *   npm run db:seed
 *
 * It makes the product DEMONSTRABLE rather than merely correct:
 *
 *   - a hero row that went all the way — posted, accepted, photographed,
 *     verified and PAID, with a real payout row, a real webhook event and a
 *     real audit trail. It is produced by running the ACTUAL money path, not
 *     by inserting rows, so the timestamps and the latency are true.
 *   - a REJECTED row with a visibly failing rule: the tag reads $9.99 when
 *     $6.00 was expected, so the value rule fails and no payout exists.
 *   - a PAYOUT_FAILED row, produced by the mock provider's designated
 *     failure recipient.
 *   - about forty rows spread across every state, so the ops ledger is a real
 *     ledger and not a single lonely row.
 *   - one live claim link, printed to stdout, so the demo can start the
 *     instant the seed finishes.
 *
 * It is IDEMPOTENT and DETERMINISTIC. Running it twice produces the same
 * rows with the same identifiers, because the filler rows use a fixed seed
 * and fixed ids.
 *
 * SAFETY: the seed truncates tables. It refuses to run against a database
 * that is not ours.
 */

import { loadLocalEnv } from "../scripts/load-env";

loadLocalEnv();

import { closeDb, db } from "../src/server/db/client";
import { getEnv, resetEnvCache } from "../src/server/env";
import { issueClaimToken } from "../src/server/tokens";
import { runMoneyPath, startWebhookSink } from "../scripts/lib/money-path";

const SAFE_DATABASES = new Set(["groundtruth", "groundtruth_test"]);

const STORES = [
  { name: "Ferry Plaza Market", address: "1 Ferry Building, San Francisco, CA", lat: 37.7955, lng: -122.3937 },
  { name: "Rainbow Grocery", address: "1745 Folsom St, San Francisco, CA", lat: 37.7699, lng: -122.4108 },
  { name: "Bi-Rite Market", address: "3639 18th St, San Francisco, CA", lat: 37.7614, lng: -122.4247 },
  { name: "Canyon Market", address: "1000 Market St, San Francisco, CA", lat: 37.7787, lng: -122.4136 },
  { name: "Grove Market", address: "1740 Grove St, San Francisco, CA", lat: 37.7706, lng: -122.4288 },
];

/**
 * The spread of statuses for the filler rows.
 *
 * Weighted towards the states a real ledger spends its time in, but every
 * state appears at least once, so the grid shows the whole vocabulary.
 */
const FILLER_STATUSES = [
  "PAID", "PAID", "PAID", "PAID", "PAID", "PAID", "PAID", "PAID",
  "REJECTED", "REJECTED", "REJECTED", "REJECTED",
  "PAYING", "PAYING", "PAYING",
  "CLAIMED", "CLAIMED", "CLAIMED",
  "POSTED", "POSTED", "POSTED", "POSTED",
  "SUBMITTED", "SUBMITTED",
  "VERIFYING", "VERIFYING",
  "VERIFIED",
  "PAYOUT_FAILED", "PAYOUT_FAILED",
  "PAYOUT_BLOCKED",
  "EXPIRED",
  "CANCELLED",
];

/** A deterministic pseudo-random source, so the seed is reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function assertSafeToSeed(): void {
  const url = process.env.DATABASE_URL ?? "";
  const database = url.split("/").pop()?.split("?")[0] ?? "";
  if (!SAFE_DATABASES.has(database)) {
    throw new Error(
      `Refusing to seed "${database || "unknown"}". The seed truncates tables, ` +
        "so it only ever runs against a GroundTruth database.",
    );
  }
}

/** A stable, valid UUID for a filler row. */
function fillerId(index: number): string {
  return `0000f000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

async function truncateEverything(): Promise<void> {
  const sql = db();
  // Schema qualified, so the seed can only ever empty GroundTruth's own
  // tables even when it shares a database server with something else.
  await sql`TRUNCATE TABLE
    ${sql("bounty_events")},
    ${sql("webhook_events")},
    ${sql("verification_checks")},
    ${sql("payouts")},
    ${sql("evidence")},
    ${sql("bounties")}
    RESTART IDENTITY CASCADE`;
}

async function insertFillerRows(): Promise<void> {
  const sql = db();
  const random = makeRandom(20261112);
  const now = Date.now();

  for (const [index, status] of FILLER_STATUSES.entries()) {
    const id = fillerId(index + 1);
    const store = STORES[Math.floor(random() * STORES.length)];
    const sku = String(1000 + Math.floor(random() * 8999));
    const expected = 300 + Math.floor(random() * 27) * 100;
    const reward = 200 + Math.floor(random() * 10) * 100;
    const createdAt = new Date(now - Math.floor(random() * 30 * 24 * 3_600_000));
    // A capture close to the store, but not exactly on it.
    const jitter = (random() - 0.5) * 0.0012;

    const claimed = status !== "POSTED" && status !== "CANCELLED";
    const paid = status === "PAID";

    await sql`
      INSERT INTO bounties (
        id, status, sku, store_name, store_address, store_lat, store_lon,
        radius_m, expected_value_cents, tolerance_pct, currency, reward_cents,
        requester_email, claim_token_hash, claimed_by_email, claimed_at,
        submitted_at, captured_at, capture_lat, capture_lon, capture_accuracy_m,
        evidence_path, evidence_thumb_path, evidence_bytes, evidence_mime,
        model_verdict, model_confidence, model_observed_cents, model_provider,
        model_latency_ms, mock_scenario, created_at, updated_at, expires_at
      ) VALUES (
        ${id}, ${status}, ${sku}, ${store.name}, ${store.address},
        ${store.lat}, ${store.lng}, 250, ${expected}, 10, 'USD', ${reward},
        'agent@groundtruth.test', ${claimed ? null : `seeded-hash-${index}`},
        ${claimed ? `worker${index % 9}@example.com` : null},
        ${claimed ? createdAt : null},
        ${claimed ? new Date(createdAt.getTime() + 20_000) : null},
        ${claimed ? new Date(createdAt.getTime() + 30_000) : null},
        ${claimed ? store.lat + jitter : null},
        ${claimed ? store.lng + jitter : null},
        ${claimed ? 12 : null},
        ${claimed ? `bounties/${id}/full.jpg` : null},
        ${claimed ? `bounties/${id}/thumb.jpg` : null},
        ${claimed ? 240_000 + index : null},
        ${claimed ? "image/jpeg" : null},
        ${claimed ? "match" : null},
        ${claimed ? 0.93 : null},
        ${claimed ? expected : null},
        ${claimed ? "mock" : null},
        ${claimed ? 150 : null},
        ${claimed ? "match" : null},
        ${createdAt}, ${createdAt}, ${new Date(createdAt.getTime() + 86_400_000)}
      )
    `;

    if (claimed) {
      await sql`
        INSERT INTO evidence (
          bounty_id, media_path, thumb_path, bytes, mime, sha256,
          captured_at, lat, lon, accuracy_m
        ) VALUES (
          ${id}, ${`bounties/${id}/full.jpg`}, ${`bounties/${id}/thumb.jpg`},
          ${240_000 + index}, 'image/jpeg', null,
          ${new Date(createdAt.getTime() + 30_000)},
          ${store.lat + jitter}, ${store.lng + jitter}, 12
        )
      `;
    }

    if (paid || status === "PAYOUT_FAILED" || status === "PAYOUT_BLOCKED" || status === "PAYING") {
      const paidAt = new Date(createdAt.getTime() + 45_000);
      const payoutStatus =
        status === "PAYING"
          ? "SUBMITTED"
          : status === "PAYOUT_FAILED"
            ? "FAILED"
            : status === "PAYOUT_BLOCKED"
              ? "BLOCKED"
              : "PAID";

      await sql`
        INSERT INTO payouts (
          bounty_id, sender_batch_id, status, amount_cents, currency,
          payee_email, provider, external_id, paid_at, created_at, updated_at
        ) VALUES (
          ${id}, ${`gt-bounty-${id}-v1`}, ${payoutStatus}, ${reward}, 'USD',
          ${`worker${index % 9}@example.com`}, 'mock',
          ${`MOCKITEM-SEED${String(index).padStart(4, "0")}`},
          ${payoutStatus === "PAID" ? paidAt : null},
          ${createdAt}, ${paidAt}
        )
      `;
    }

    await sql`
      INSERT INTO bounty_events (bounty_id, type, payload, created_at)
      VALUES (
        ${id}, 'created',
        ${sql.json({ seeded: true, sku })},
        ${createdAt}
      )
    `;
  }
}

async function main(): Promise<void> {
  assertSafeToSeed();

  // The mock provider delivers its webhook to APP_URL, so the seed points
  // APP_URL at a local sink that applies the event exactly as the route
  // handler does.
  const sink = await startWebhookSink();
  process.env.APP_URL = sink.url;
  resetEnvCache();

  console.log("clearing the ledger");
  await truncateEverything();

  console.log("running the money path for the hero row");
  const hero = await runMoneyPath({
    id: "11111111-1111-4111-8111-000000000001",
    sku: "4471",
    storeName: STORES[0].name,
    storeAddress: STORES[0].address,
    storeLat: STORES[0].lat,
    storeLng: STORES[0].lng,
    expectedValueCents: 600,
    rewardCents: 600,
    payeeEmail: "sam@shopper.test",
    mockScenario: "match",
  });
  console.log(`  hero      ${hero.status}  ${hero.bountyId}`);

  console.log("running the money path for the rejected row");
  const rejected = await runMoneyPath({
    id: "11111111-1111-4111-8111-000000000002",
    sku: "2210",
    storeName: STORES[1].name,
    storeAddress: STORES[1].address,
    storeLat: STORES[1].lat,
    storeLng: STORES[1].lng,
    expectedValueCents: 600,
    rewardCents: 600,
    payeeEmail: "riley@shopper.test",
    mockScenario: "mismatch",
  });
  console.log(
    `  rejected  ${rejected.status}  failed: ${rejected.failedRuleIds.join(", ") || "none"}`,
  );

  console.log("running the money path for the failed payout");
  const failed = await runMoneyPath({
    id: "11111111-1111-4111-8111-000000000003",
    sku: "3390",
    storeName: STORES[2].name,
    storeAddress: STORES[2].address,
    storeLat: STORES[2].lat,
    storeLng: STORES[2].lng,
    expectedValueCents: 1_200,
    rewardCents: 900,
    payeeEmail: getEnv().PAYPAL_MOCK_FAIL_EMAIL,
    mockScenario: "match",
  });
  console.log(`  failed    ${failed.status}  ${failed.bountyId}`);

  console.log(`inserting ${FILLER_STATUSES.length} filler rows`);
  await insertFillerRows();

  // One live claim link, so the demo can start immediately.
  const sql = db();
  const open = await sql<{ id: string; sku: string }[]>`
    SELECT id, sku FROM bounties WHERE status = 'POSTED' ORDER BY created_at ASC LIMIT 1
  `;
  const target = open[0];
  let claimLink = "";
  if (target) {
    const { token, hash } = issueClaimToken(target.id);
    await sql`UPDATE bounties SET claim_token_hash = ${hash} WHERE id = ${target.id}`;
    const origin = getEnv().APP_URL.replace(/\/+$/, "");
    claimLink = `${origin}/claim/${token}`;
  }

  const counts = await sql<{ status: string; count: number }[]>`
    SELECT status, COUNT(*)::int AS count FROM bounties GROUP BY status ORDER BY status
  `;

  console.log("");
  console.log("seeded:");
  for (const row of counts) {
    console.log(`  ${row.status.padEnd(15)} ${row.count}`);
  }
  console.log("");
  console.log("webhook events received by the sink:", sink.received.length);
  for (const event of sink.received) {
    console.log(`  ${event.id}  ->  ${event.outcome}`);
  }
  console.log("");
  if (claimLink) {
    console.log("a live claim link — open it on a phone and accept the bounty:");
    console.log(`  ${claimLink}`);
  }

  await sink.close();
  await closeDb();
}

main().catch(async (error) => {
  console.error("seed failed:", error instanceof Error ? error.message : error);
  await closeDb().catch(() => {});
  process.exit(1);
});
