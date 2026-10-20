/**
 * The money path, headless.
 *
 * The seed and the rehearsal both need to drive the whole product — post,
 * accept, capture, verify, pay — without a browser and without a running
 * Next.js server. This module is that driver.
 *
 * The one subtlety is the WEBHOOK. The mock PayPal provider does not
 * fabricate a database update: it delivers a genuinely SIGNED webhook to
 * `POST {APP_URL}/api/paypal/webhook`, exactly as PayPal would. So the driver
 * starts a tiny HTTP server that does precisely what the route handler does —
 * read the raw bytes, verify the signature, then apply the event — and points
 * APP_URL at it.
 *
 * The result is that the rehearsal exercises the real webhook path, the real
 * signature verification and the real insert-first idempotency check.
 * Nothing is faked.
 */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { db } from "../../src/server/db/client";
import {
  getBountyById,
  getPayoutByBountyId,
  insertEvidence,
  transitionBounty,
} from "../../src/server/db/queries";
import { getPayPalProvider } from "../../src/server/paypal";
import { SIGNATURE_HEADER } from "../../src/server/paypal/sign";
import { senderBatchId } from "../../src/domain/money";
import { claimBounty, createBounty } from "../../src/server/services/bounty";
import { applyWebhookEvent, payVerifiedBounty } from "../../src/server/services/payout";
import { verifySubmission } from "../../src/server/services/verification";

export interface WebhookSink {
  /** The origin to point APP_URL at. */
  url: string;
  /** Every event the sink received, with the outcome it produced. */
  received: { id: string; outcome: string }[];
  /**
   * Deliver the LAST event again, exactly as PayPal would on a retry.
   * The result is the outcome the sink produced the second time.
   */
  replayLast: () => Promise<string>;
  close: () => Promise<void>;
}

/**
 * A stand-in for the webhook route handler.
 *
 * It is the same three steps, in the same order, with the same provider:
 * raw bytes, signature, apply. A signature that does not verify changes
 * nothing.
 */
export async function startWebhookSink(): Promise<WebhookSink> {
  const received: { id: string; outcome: string }[] = [];
  let lastDelivery: { body: string; signature: string | undefined } | null = null;

  const server: Server = createServer((request, response) => {
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }

    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      void (async () => {
        const raw = Buffer.concat(chunks).toString("utf8");

        const headers: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(request.headers)) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
        }

        lastDelivery = { body: raw, signature: headers[SIGNATURE_HEADER] ?? undefined };

        const provider = getPayPalProvider();

        let verified = false;
        try {
          verified = await provider.verifyWebhook(headers, raw);
        } catch {
          verified = false;
        }
        if (!verified) {
          response.writeHead(401).end("unauthorized");
          return;
        }

        let event;
        try {
          event = provider.parseWebhook(raw);
        } catch {
          response.writeHead(400).end("unreadable event");
          return;
        }

        const outcome = await applyWebhookEvent(event);
        received.push({ id: event.id, outcome });

        response
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify({ success: true, outcome }));
      })();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    received,
    replayLast: async () => {
      if (!lastDelivery) throw new Error("nothing has been delivered yet");
      const response = await fetch(`${url}/api/paypal/webhook`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(lastDelivery.signature ? { [SIGNATURE_HEADER]: lastDelivery.signature } : {}),
        },
        body: lastDelivery.body,
      });
      const body = (await response.json()) as { outcome?: string };
      return body.outcome ?? `http-${response.status}`;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/**
 * Remove a set of bounties and everything that belongs to them.
 *
 * The rehearsal is meant to be run again and again, so it has to start from
 * a clean slate. The webhook events have to go too: the mock's event id is
 * derived from the sender_batch_id, so a second run would collide with the
 * first and the insert-first idempotency would (correctly) treat it as a
 * replay — leaving the bounty stuck at PAYING.
 */
export async function clearBounties(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const sql = db();

  for (const id of ids) {
    await sql`DELETE FROM webhook_events WHERE payload->>'senderBatchId' = ${senderBatchId(id)}`;
  }
  await sql`DELETE FROM bounty_events WHERE bounty_id IN ${sql(ids)}`;
  await sql`DELETE FROM verification_checks WHERE bounty_id IN ${sql(ids)}`;
  await sql`DELETE FROM payouts WHERE bounty_id IN ${sql(ids)}`;
  await sql`DELETE FROM evidence WHERE bounty_id IN ${sql(ids)}`;
  await sql`DELETE FROM bounties WHERE id IN ${sql(ids)}`;
}

export interface MoneyPathInput {
  /** A fixed id, so a seeded row keeps its identity across re-seeds. */
  id?: string;
  sku: string;
  storeName: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  expectedValueCents: number;
  rewardCents: number;
  payeeEmail: string;
  /** The mock vision scenario. */
  mockScenario?: string | null;
  captureLat?: number;
  captureLng?: number;
  captureAccuracyM?: number;
  /** How stale the capture is, in minutes. Used to fail the freshness rule. */
  captureAgeMinutes?: number;
}

export interface MoneyPathResult {
  bountyId: string;
  status: string;
  claimToken: string;
  passed: boolean;
  failedRuleIds: string[];
  payout: {
    status: string;
    amountCents: number;
    currency: string;
    payeeEmail: string;
    senderBatchId: string;
    externalId: string | null;
  } | null;
}

/**
 * Drive one bounty from POSTED all the way to a terminal state.
 *
 * The order is the order the product uses, and it is the order the invariants
 * depend on: claim, submit, verify, and only then pay.
 */
export async function runMoneyPath(input: MoneyPathInput): Promise<MoneyPathResult> {
  const sql = db();

  const { bounty, claimToken } = await createBounty({
    id: input.id,
    sku: input.sku,
    storeName: input.storeName,
    storeAddress: input.storeAddress,
    storeLat: input.storeLat,
    storeLng: input.storeLng,
    radiusM: 250,
    expectedValueCents: input.expectedValueCents,
    tolerancePct: 10,
    currency: "USD",
    rewardCents: input.rewardCents,
    requesterEmail: "agent@groundtruth.test",
    expiresAt: new Date(Date.now() + 24 * 3_600_000),
    mockScenario: input.mockScenario ?? null,
  });

  // The human accepts: the token is redeemed and the payee is recorded.
  await claimBounty(claimToken, input.payeeEmail);

  const submitted = await transitionBounty(sql, bounty.id, "CLAIMED", "SUBMITTED");
  if (!submitted) throw new Error(`could not submit ${bounty.id}`);

  const capturedAt = new Date(
    Date.now() - (input.captureAgeMinutes ?? 0) * 60_000,
  );

  await insertEvidence(sql, {
    bountyId: bounty.id,
    mediaPath: `bounties/${bounty.id}/full.jpg`,
    thumbPath: null,
    bytes: 245_000,
    mime: "image/jpeg",
    sha256: null,
    capturedAt,
    lat: input.captureLat ?? input.storeLat,
    lon: input.captureLng ?? input.storeLng,
    accuracyM: input.captureAccuracyM ?? 8,
  });

  const outcome = await verifySubmission(bounty.id);

  let payout: MoneyPathResult["payout"] = null;
  if (outcome.passed) {
    await payVerifiedBounty(bounty.id);
    const fresh = await getPayoutByBountyId(sql, bounty.id);
    payout = fresh
      ? {
          status: fresh.status,
          amountCents: fresh.amountCents,
          currency: fresh.currency,
          payeeEmail: fresh.payeeEmail,
          senderBatchId: fresh.senderBatchId,
          externalId: fresh.externalId,
        }
      : null;
  }

  const fresh = await getBountyById(sql, bounty.id);

  return {
    bountyId: bounty.id,
    status: fresh?.status ?? "UNKNOWN",
    claimToken,
    passed: outcome.passed,
    failedRuleIds: outcome.failedRuleIds,
    payout,
  };
}
