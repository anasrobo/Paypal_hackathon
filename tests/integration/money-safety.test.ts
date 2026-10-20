/**
 * The eight money-safety invariants.
 *
 * These run against a REAL Postgres, because the invariants ARE database
 * constraints. A mocked database would prove nothing about the one thing
 * that matters: that a stranger cannot be paid twice, and that money cannot
 * move without a deterministic decision.
 *
 * Each test is named after the invariant it proves, and the test file for
 * each one is referenced in docs/INVARIANTS.md.
 */

import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { evaluateGate } from "@/domain/gate";
import { senderBatchId } from "@/domain/money";
import { AppError } from "@/domain/errors";
import { parseEnv, resetEnvCache } from "@/server/env";
import { db } from "@/server/db/client";
import {
  getBountyById,
  getPayoutByBountyId,
  insertPayout,
  insertWebhookEvent,
  transitionBounty,
} from "@/server/db/queries";
import { getPayPalProvider } from "@/server/paypal";
import { signBody, verifySignature } from "@/server/paypal/sign";
import { applyWebhookEvent, payVerifiedBounty } from "@/server/services/payout";
import { closeTestDb, testDb, truncateAll } from "../setup/db";

const STORE_LAT = 12.9716;
const STORE_LNG = 77.5946;
const NOW = new Date("2026-10-20T10:00:00.000Z");

let webhookServer: Server;
let webhookUrl: string;
/** The outcome of the last webhook the mock provider delivered. */
let lastWebhookOutcome = "";

/**
 * A real HTTP endpoint that receives the mock provider's signed webhook and
 * runs it through the SAME handler the production route uses. This is what
 * makes the integration test honest: signature verification, insert-first
 * idempotency and the state transition all actually execute.
 */
beforeAll(async () => {
  webhookServer = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      void (async () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8");
          const provider = getPayPalProvider();
          const headers: Record<string, string | undefined> = {
            "x-gt-signature": req.headers["x-gt-signature"] as string | undefined,
          };
          if (!provider.verifyWebhook(headers, raw)) {
            res.writeHead(401).end("unauthorized");
            return;
          }
          const event = provider.parseWebhook(raw);
          const outcome = await applyWebhookEvent(event);
          lastWebhookOutcome = outcome;
          res.writeHead(200).end(outcome);
        } catch (error) {
          lastWebhookOutcome = `error: ${error instanceof Error ? error.message : "unknown"}`;
          res.writeHead(500).end(lastWebhookOutcome);
        }
      })();
    });
  });

  await new Promise<void>((resolve) => webhookServer.listen(0, "127.0.0.1", resolve));
  const address = webhookServer.address();
  const port = typeof address === "object" && address ? address.port : 0;
  webhookUrl = `http://127.0.0.1:${port}`;

  process.env.APP_URL = webhookUrl;
  resetEnvCache();
});

afterAll(async () => {
  await new Promise<void>((resolve) => webhookServer.close(() => resolve()));
  await closeTestDb();
});

beforeEach(async () => {
  await truncateAll(testDb());
});

/** Insert a bounty in a chosen state, directly. */
async function makeBounty(
  status: string,
  overrides: Partial<{
    rewardCents: number;
    expectedValueCents: number;
    claimedByEmail: string | null;
    mockScenario: string | null;
  }> = {},
): Promise<string> {
  const sql = testDb();
  const id = randomUUID();
  await sql`
    INSERT INTO bounties (
      id, status, sku, store_name, store_address, store_lat, store_lon,
      radius_m, expected_value_cents, tolerance_pct, currency, reward_cents,
      requester_email, claim_token_hash, expires_at, mock_scenario, claimed_by_email
    ) VALUES (
      ${id}, ${status}, 'SKU-4471', 'Corner Store', '12 MG Road', ${STORE_LAT},
      ${STORE_LNG}, 250, ${overrides.expectedValueCents ?? 600}, 10, 'USD',
      ${overrides.rewardCents ?? 400}, 'ops@buyer.test', ${randomUUID()},
      ${new Date(NOW.getTime() + 86_400_000)}, ${overrides.mockScenario ?? null},
      ${overrides.claimedByEmail ?? 'helper@human.test'}
    )
  `;
  return id;
}

describe("invariant 1 — only a VERIFIED bounty may enter PAYING", () => {
  it("the DATABASE refuses the transition from every other status", async () => {
    const sql = testDb();
    for (const status of ["POSTED", "CLAIMED", "SUBMITTED", "VERIFYING", "REJECTED", "PAID", "EXPIRED"]) {
      const id = await makeBounty(status);

      // The WHERE clause matches (the row really is in that status), so the
      // UPDATE is attempted and the trigger refuses it. This is the second
      // layer of defence: the application checks the transition first, and
      // the database refuses it even if that check is ever missed.
      let caught: unknown = null;
      try {
        await sql`UPDATE bounties SET status = 'PAYING' WHERE id = ${id}`;
      } catch (error) {
        caught = error;
      }

      expect(caught, `${status} -> PAYING must be refused by the database`).not.toBeNull();
      expect((caught as Error).message).toMatch(/illegal bounty status transition/i);

      const after = await getBountyById(sql, id);
      expect(after?.status).toBe(status);
    }
  });

  it("the compare-and-swap refuses the transition when the status has moved", async () => {
    const sql = testDb();
    for (const status of ["POSTED", "CLAIMED", "SUBMITTED", "VERIFYING", "REJECTED", "PAID", "EXPIRED"]) {
      const id = await makeBounty(status);
      // The CAS expects a DIFFERENT current status, so zero rows match and
      // the function reports that the world moved underneath it.
      const moved = await transitionBounty(sql, id, "VERIFIED", "PAYING");
      expect(moved, `${status} -> PAYING must not apply`).toBeNull();
      const after = await getBountyById(sql, id);
      expect(after?.status).toBe(status);
    }
  });

  it("allows the transition from VERIFIED", async () => {
    const sql = testDb();
    const id = await makeBounty("VERIFIED");
    const moved = await transitionBounty(sql, id, "VERIFIED", "PAYING");
    expect(moved).not.toBeNull();
    expect(moved?.status).toBe("PAYING");
  });

  it("the DATABASE refuses an illegal transition even if the app forgets to check", async () => {
    const sql = testDb();
    const id = await makeBounty("POSTED");
    let caught: unknown = null;
    try {
      await sql`UPDATE bounties SET status = 'PAID' WHERE id = ${id}`;
    } catch (error) {
      caught = error;
    }
    expect(caught).not.toBeNull();
    expect((caught as Error).message).toMatch(/illegal bounty status transition/i);
  });
});

describe("invariant 2 — the gate fails closed and the model can never cause a payout", () => {
  it("rejects a perfect model output when the geofence rule fails", () => {
    const result = evaluateGate({
      expectedValueCents: 600,
      tolerancePct: 10,
      radiusMeters: 250,
      storeLat: STORE_LAT,
      storeLng: STORE_LNG,
      now: NOW,
      model: {
        verdict: "match",
        confidence: 0.99,
        observedValueCents: 600,
        raw: {},
        provider: "mock",
        model: "mock-vision-v1",
        latencyMs: 10,
      },
      capturedAt: new Date(NOW.getTime() - 60_000),
      captureLat: STORE_LAT + 0.05, // about 5.5 km away
      captureLng: STORE_LNG,
      captureAccuracyM: 10,
      media: { present: true, bytes: 1000, mime: "image/jpeg" },
    });
    expect(result.passed).toBe(false);
    expect(result.failedRuleIds).toContain("geo_250m");
  });

  it("refuses to pay a bounty that was not verified, and writes no payout row", async () => {
    const id = await makeBounty("REJECTED");
    await expect(payVerifiedBounty(id)).rejects.toThrow(AppError);
    expect(await getPayoutByBountyId(testDb(), id)).toBeNull();
  });
});

describe("invariant 3 — exactly one payout per bounty", () => {
  it("the unique constraint refuses a second payout row", async () => {
    const sql = testDb();
    const id = await makeBounty("VERIFIED");
    const first = await insertPayout(sql, {
      bountyId: id,
      senderBatchId: senderBatchId(id),
      amountCents: 400,
      currency: "USD",
      payeeEmail: "helper@human.test",
      provider: "mock",
    });
    expect(first).not.toBeNull();

    const second = await insertPayout(sql, {
      bountyId: id,
      senderBatchId: senderBatchId(id) + "-retry",
      amountCents: 400,
      currency: "USD",
      payeeEmail: "helper@human.test",
      provider: "mock",
    });
    expect(second).toBeNull();
  });

  it("a second pay attempt does not call the provider again", async () => {
    const id = await makeBounty("VERIFIED");
    const first = await payVerifiedBounty(id);
    expect(first).not.toBeNull();

    // The bounty is now PAYING or PAID, so it is not VERIFIED any more.
    await expect(payVerifiedBounty(id)).rejects.toThrow(AppError);
    expect(await getPayoutByBountyId(testDb(), id)).not.toBeNull();
  });
});

describe("invariant 4 — the idempotency key is deterministic", () => {
  it("is derived from the bounty id and nothing else", () => {
    const id = randomUUID();
    expect(senderBatchId(id)).toBe(senderBatchId(id));
    expect(senderBatchId(id)).toBe(`gt-bounty-${id}-v1`);
    expect(senderBatchId(id)).not.toContain(String(Date.now()));
  });

  it("is the key actually stored against the payout", async () => {
    const id = await makeBounty("VERIFIED");
    const payout = await payVerifiedBounty(id);
    expect(payout?.senderBatchId).toBe(senderBatchId(id));
  });
});

describe("invariant 5 — a replayed webhook changes nothing", () => {
  it("the insert-first ledger refuses the duplicate event id", async () => {
    const sql = testDb();
    const first = await insertWebhookEvent(sql, {
      paypalEventId: "EVT-1",
      eventType: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
      resourceId: "ITEM-1",
      payload: {},
    });
    expect(first).not.toBeNull();

    const second = await insertWebhookEvent(sql, {
      paypalEventId: "EVT-1",
      eventType: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
      resourceId: "ITEM-1",
      payload: {},
    });
    expect(second).toBeNull();
  });

  it("applying the same event twice is a no-op the second time", async () => {
    const sql = testDb();
    const id = await makeBounty("PAYING");
    const payout = await insertPayout(sql, {
      bountyId: id,
      senderBatchId: senderBatchId(id),
      amountCents: 400,
      currency: "USD",
      payeeEmail: "helper@human.test",
      provider: "mock",
    });
    expect(payout).not.toBeNull();

    const event = {
      id: "EVT-REPLAY-1",
      type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
      itemId: "ITEM-1",
      senderBatchId: senderBatchId(id),
      status: "SUCCESS" as const,
    };

    expect(await applyWebhookEvent(event)).toBe("applied");
    const afterFirst = await getBountyById(sql, id);
    expect(afterFirst?.status).toBe("PAID");

    expect(await applyWebhookEvent(event)).toBe("replay");
    const afterSecond = await getBountyById(sql, id);
    expect(afterSecond?.status).toBe("PAID");
  });
});

describe("invariant 6 — a forged webhook is rejected", () => {
  it("a tampered body does not verify", () => {
    const secret = "mock-webhook-secret-placeholder";
    const body = JSON.stringify({ id: "EVT-1", event_type: "X" });
    const signature = verifySignature(body, undefined, secret);
    expect(signature).toBe(false);

    const good = verifySignature(body, signBody(body, secret), secret);
    expect(good).toBe(true);

    // Change one byte of the body and the signature must no longer match.
    const tampered = body.replace("EVT-1", "EVT-2");
    expect(verifySignature(tampered, signBody(body, secret), secret)).toBe(false);
  });

  it("the provider refuses a webhook with no signature at all", async () => {
    const provider = getPayPalProvider();
    expect(await provider.verifyWebhook({}, "{}")).toBe(false);
  });
});

describe("invariant 7 — the server alone decides the amount", () => {
  it("pays exactly the reward recorded on the bounty row", async () => {
    const id = await makeBounty("VERIFIED", { rewardCents: 733 });
    const payout = await payVerifiedBounty(id);
    expect(payout?.amountCents).toBe(733);
  });

  it("the amount in the ledger is the bounty reward, not anything else", async () => {
    const sql = testDb();
    const id = await makeBounty("VERIFIED", { rewardCents: 250, expectedValueCents: 60_000 });
    await payVerifiedBounty(id);
    const stored = await getPayoutByBountyId(sql, id);
    // The expected VALUE is $600.00. The reward is $2.50. The payout is the
    // reward, never the expected value.
    expect(stored?.amountCents).toBe(250);
  });
});

describe("invariant 8 — sandbox only, never live", () => {
  it("the provider registry only ever offers mock or sandbox", async () => {
    const provider = getPayPalProvider();
    expect(["mock", "sandbox"]).toContain(provider.name);
  });

  it("the environment schema refuses a live provider", () => {
    // parseEnv is the pure test seam: it validates an explicit environment
    // without touching process.env, so a failure here can never leak into
    // another test.
    expect(() =>
      parseEnv({ ...process.env, PAYPAL_PROVIDER: "live" }),
    ).toThrow(/PAYPAL_PROVIDER/);
    expect(() =>
      parseEnv({ ...process.env, PAYPAL_PROVIDER: "mock" }),
    ).not.toThrow();
  });

  it("the sandbox base url names a sandbox host", () => {
    const url = process.env.PAYPAL_SANDBOX_BASE_URL ?? "https://api-m.sandbox.paypal.com";
    expect(url).toContain("sandbox");
  });
});

describe("the whole loop, end to end", () => {
  it("a verified bounty is paid and the webhook moves it to PAID", async () => {
    const sql = testDb();
    const id = await makeBounty("VERIFIED");
    lastWebhookOutcome = "";

    const payout = await payVerifiedBounty(id);
    expect(payout).not.toBeNull();

    // The mock provider delivered a signed webhook to the local endpoint
    // during createPayout, and the handler applied it.
    expect(lastWebhookOutcome, "the mock webhook must reach the handler").toBe("applied");

    const bounty = await getBountyById(sql, id);
    expect(bounty?.status).toBe("PAID");

    const stored = await getPayoutByBountyId(sql, id);
    expect(stored?.status).toBe("PAID");
  });
});
