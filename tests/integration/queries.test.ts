/**
 * The row mapping.
 *
 * The connection transforms every column name to camel case. That is
 * convenient, and it is also a trap: a query that reads `row.in_flight` when
 * the database says `inFlight` gets `undefined`, and `Number(undefined ?? 0)`
 * is a very convincing zero.
 *
 * That bug shipped. The console said "18 paid" next to "$0.00 paid out",
 * because the aggregate row was read with the wrong key names. It is the
 * second time this class of bug has bitten this project — the first was
 * `store_lon` arriving as `storeLon` while the code read `storeLng`, which
 * silently failed the geofence rule for every bounty.
 *
 * So the mapping is TESTED, against a real database, rather than trusted.
 */

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getBountyById,
  getBountyKpis,
  getPayoutByBountyId,
} from "@/server/db/queries";
import { testDb, truncateAll } from "../setup/db";

const STORE_LAT = 37.7955;
const STORE_LNG = -122.3937;

async function makeBounty(status: string, rewardCents: number): Promise<string> {
  const id = randomUUID();
  // The insert is raw SQL on purpose: the state trigger refuses an illegal
  // transition, so a row cannot simply be UPDATEd into a status it could
  // never have reached. It has to be born in it.
  await testDb()`
    INSERT INTO bounties (
      id, status, sku, store_name, store_address, store_lat, store_lon,
      radius_m, expected_value_cents, tolerance_pct, currency, reward_cents,
      requester_email, claim_token_hash, expires_at, mock_scenario
    ) VALUES (
      ${id}, ${status}, 'SKU-1', 'Corner Store', '12 MG Road',
      ${STORE_LAT}, ${STORE_LNG}, 250, 600, 10, 'USD', ${rewardCents},
      'ops@buyer.test', ${randomUUID()}, ${new Date(Date.now() + 86_400_000)}, null
    )
  `;
  return id;
}

describe("the row mapping", () => {
  beforeEach(async () => {
    await truncateAll(testDb());
  });

  it("maps a bounty row to camel case, including the longitude", async () => {
    const id = await makeBounty("POSTED", 600);
    const bounty = await getBountyById(testDb(), id);

    expect(bounty).not.toBeNull();
    expect(bounty?.storeLat).toBe(STORE_LAT);
    // The column is `store_lon`. The transform gives `storeLng` only because
    // the query builder ALIASES it. Reading `storeLon` here would be
    // undefined, and the geofence rule would fail for every bounty.
    expect(bounty?.storeLng).toBe(STORE_LNG);
    expect(bounty?.radiusM).toBe(250);
    expect(bounty?.expectedValueCents).toBe(600);
    expect(bounty?.rewardCents).toBe(600);
    expect(bounty?.mockScenario).toBeNull();
  });

  it("maps the aggregate KPI row to camel case", async () => {
    await makeBounty("PAID", 600);
    await makeBounty("PAID", 300);
    await makeBounty("POSTED", 100);
    await makeBounty("REJECTED", 200);

    const kpis = await getBountyKpis(testDb());

    expect(kpis.total).toBe(4);
    expect(kpis.paid).toBe(2);
    expect(kpis.posted).toBe(1);
    expect(kpis.failed).toBe(1);
    // POSTED counts as in flight.
    expect(kpis.inFlight).toBe(1);
    // 600 + 300. Reading `paid_cents` here returned undefined, and the
    // console showed "$0.00 paid out" next to "2 paid".
    expect(kpis.paidCents).toBe(900);
  });

  it("reports zero for an empty ledger rather than undefined", async () => {
    const kpis = await getBountyKpis(testDb());
    expect(kpis.total).toBe(0);
    expect(kpis.inFlight).toBe(0);
    expect(kpis.paidCents).toBe(0);
  });

  it("maps a payout row to camel case", async () => {
    const id = await makeBounty("VERIFIED", 400);
    const sql = testDb();
    await sql`
      INSERT INTO payouts (bounty_id, sender_batch_id, status, amount_cents, currency, payee_email, provider)
      VALUES (${id}, ${`gt-bounty-${id}-v1`}, 'SUBMITTED', 400, 'USD', 'helper@human.test', 'mock')
    `;

    const payout = await getPayoutByBountyId(sql, id);
    expect(payout?.bountyId).toBe(id);
    expect(payout?.senderBatchId).toBe(`gt-bounty-${id}-v1`);
    expect(payout?.amountCents).toBe(400);
    expect(payout?.payeeEmail).toBe("helper@human.test");
    expect(payout?.externalId).toBeNull();
    expect(payout?.paidAt).toBeNull();
  });
});
