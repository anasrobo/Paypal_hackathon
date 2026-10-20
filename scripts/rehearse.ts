/**
 * The rehearsal.
 *
 *   npm run rehearse
 *
 * It drives the whole money path headlessly and exits NON-ZERO on any miss.
 * It is the last gate before a deploy: if this passes, the demo works.
 *
 * The checks are the money-safety invariants, exercised against the real
 * database, the real gate and the real webhook handler:
 *
 *   1. A verified bounty is paid, and the webhook that confirms it lands.
 *   2. A REPLAYED webhook changes nothing. A duplicate delivery is a no-op.
 *   3. A rejected bounty produces NO payout row at all.
 *   4. The idempotency key is derived from the bounty, never random.
 *   5. The amount paid is the amount on the bounty row.
 */

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

import { closeDb, db } from "../src/server/db/client";
import { getBountyById, getPayoutByBountyId } from "../src/server/db/queries";
import { resetEnvCache } from "../src/server/env";
import { senderBatchId } from "../src/domain/money";
import { runMoneyPath, startWebhookSink, clearBounties } from "./lib/money-path";

const STORE = {
  name: "Rehearsal Market",
  address: "1 Test Street, San Francisco, CA",
  lat: 37.7955,
  lng: -122.3937,
};

let failures = 0;

function check(name: string, passed: boolean, detail = ""): void {
  if (passed) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const HERO_ID = "22222222-2222-4222-8222-000000000001";
const REJECTED_ID = "22222222-2222-4222-8222-000000000002";

async function main(): Promise<void> {
  const sink = await startWebhookSink();
  process.env.APP_URL = sink.url;
  resetEnvCache();

  // The rehearsal must be repeatable, so it starts by removing the rows a
  // previous run left behind.
  await clearBounties([HERO_ID, REJECTED_ID]);

  console.log("rehearsing the money path\n");

  // ---- 1. the happy path ---------------------------------------------------
  const happy = await runMoneyPath({
    id: HERO_ID,
    sku: "REHEARSE-1",
    storeName: STORE.name,
    storeAddress: STORE.address,
    storeLat: STORE.lat,
    storeLng: STORE.lng,
    expectedValueCents: 600,
    rewardCents: 600,
    payeeEmail: "rehearsal@shopper.test",
    mockScenario: "match",
  });

  check("a verified bounty reaches PAID", happy.status === "PAID", `status was ${happy.status}`);
  check("the payout row is PAID", happy.payout?.status === "PAID", `status was ${happy.payout?.status}`);
  check(
    "the webhook was delivered and applied",
    sink.received.length === 1 && sink.received[0].outcome === "applied",
    `received ${JSON.stringify(sink.received)}`,
  );

  const sql = db();
  const fresh = await getBountyById(sql, happy.bountyId);
  check("the bounty in the database is PAID", fresh?.status === "PAID", `status was ${fresh?.status}`);

  // ---- 2. a replayed webhook changes nothing --------------------------------
  const replayOutcome = await sink.replayLast();
  check("a replayed webhook is ignored", replayOutcome === "replay", `outcome was ${replayOutcome}`);

  const afterReplay = await getBountyById(sql, happy.bountyId);
  check(
    "the bounty did not move on the replay",
    afterReplay?.status === "PAID",
    `status was ${afterReplay?.status}`,
  );

  const payouts = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM payouts WHERE bounty_id = ${happy.bountyId}
  `;
  check(
    "there is still exactly one payout",
    Number(payouts[0]?.count ?? 0) === 1,
    `count was ${payouts[0]?.count}`,
  );

  // ---- 3. a rejected bounty pays nobody -------------------------------------
  const rejected = await runMoneyPath({
    id: REJECTED_ID,
    sku: "REHEARSE-2",
    storeName: STORE.name,
    storeAddress: STORE.address,
    storeLat: STORE.lat,
    storeLng: STORE.lng,
    expectedValueCents: 600,
    rewardCents: 600,
    payeeEmail: "rehearsal2@shopper.test",
    mockScenario: "mismatch",
  });

  check("a mismatched price is REJECTED", rejected.status === "REJECTED", `status was ${rejected.status}`);
  check(
    "the value rule is the one that failed",
    rejected.failedRuleIds.includes("value_tolerance_10pct"),
    `failed: ${rejected.failedRuleIds.join(", ") || "none"}`,
  );

  const rejectedPayouts = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM payouts WHERE bounty_id = ${rejected.bountyId}
  `;
  check(
    "a rejected bounty has NO payout row",
    Number(rejectedPayouts[0]?.count ?? 0) === 0,
    `count was ${rejectedPayouts[0]?.count}`,
  );

  // ---- 4. the idempotency key is derived, not random -------------------------
  const payout = await getPayoutByBountyId(sql, happy.bountyId);
  check(
    "the sender_batch_id is derived from the bounty",
    payout?.senderBatchId === senderBatchId(happy.bountyId),
    `was ${payout?.senderBatchId}`,
  );

  // ---- 5. the amount came from the bounty row --------------------------------
  const bountyRow = await getBountyById(sql, happy.bountyId);
  check(
    "the amount paid is the amount on the bounty",
    payout?.amountCents === bountyRow?.rewardCents,
    `paid ${payout?.amountCents}, bounty says ${bountyRow?.rewardCents}`,
  );

  console.log("");
  if (failures > 0) {
    console.log(`rehearsal FAILED — ${failures} check(s) missed`);
  } else {
    console.log("rehearsal PASSED — the money path is intact");
  }

  await sink.close();
  await closeDb();

  process.exit(failures > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error("rehearsal crashed:", error instanceof Error ? error.message : error);
  await closeDb().catch(() => {});
  process.exit(1);
});
