/**
 * The mock PayPal provider.
 *
 * It simulates Payouts AND delivers a genuinely signed webhook to our own
 * endpoint. That means the demo exercises the REAL webhook path: the same
 * signature verification, the same insert-first idempotency, the same state
 * transition. Only the network hop to PayPal is fake.
 *
 * The mock is deterministic. The same sender_batch_id always produces the
 * same item id, and a designated recipient always fails, so the seeded
 * PAYOUT_FAILED row is reproducible.
 */

import { createHash } from "node:crypto";
import { getEnv } from "../env";
import { SIGNATURE_HEADER, signBody } from "./sign";
import type {
  CreatePayoutInput,
  CreatePayoutResult,
  PayPalProvider,
  PayPalWebhookEvent,
  PayoutItemStatus,
} from "./provider";

function digest(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MockPayoutRecord {
  itemId: string;
  batchId: string;
  senderBatchId: string;
  amountCents: number;
  recipientEmail: string;
  status: PayoutItemStatus;
}

/** The mock keeps its ledger in memory. It is per process, by design. */
const ledger = new Map<string, MockPayoutRecord>();

export const mockPayPal: PayPalProvider = {
  name: "mock",

  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    const { MOCK_PAYPAL_LATENCY_MS, PAYPAL_MOCK_FAIL_EMAIL } = getEnv();
    await delay(MOCK_PAYPAL_LATENCY_MS);

    // The same sender_batch_id always yields the same ids. That mirrors
    // PayPal's own idempotency behaviour.
    const key = digest(input.senderBatchId);
    const batchId = `MOCKBATCH-${key.slice(0, 12).toUpperCase()}`;
    const itemId = `MOCKITEM-${key.slice(12, 28).toUpperCase()}`;

    // A retry with the same key returns the ORIGINAL batch, exactly as
    // PayPal does. It must not create a second payout.
    const existing = ledger.get(input.senderBatchId);
    if (existing) {
      return { batchId: existing.batchId, itemId: existing.itemId, status: existing.status };
    }

    if (input.recipientEmail === PAYPAL_MOCK_FAIL_EMAIL) {
      // The designated failure recipient. The row is still recorded, so the
      // ledger shows an attempt that did not succeed.
      ledger.set(input.senderBatchId, {
        itemId,
        batchId,
        senderBatchId: input.senderBatchId,
        amountCents: input.amountCents,
        recipientEmail: input.recipientEmail,
        status: "FAILED",
      });
      return {
        batchId,
        itemId,
        status: "FAILED",
        errorMessage: "The mock provider failed this payout on purpose.",
      };
    }

    ledger.set(input.senderBatchId, {
      itemId,
      batchId,
      senderBatchId: input.senderBatchId,
      amountCents: input.amountCents,
      recipientEmail: input.recipientEmail,
      status: "SUCCESS",
    });

    // Deliver a genuinely signed webhook to our own endpoint, so the real
    // verification and idempotency path runs.
    //
    // The payload uses PayPal's REAL event shape: `event_type` at the top
    // level, and the resource fields nested under `resource`. The mock has to
    // be a faithful simulation, because the parser is written against the
    // real format — a flat payload would be silently ignored and the bounty
    // would sit at PAYING forever.
    await deliverWebhook({
      id: `MOCK-EVT-${key.slice(0, 20).toUpperCase()}`,
      event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
      resource: {
        payout_item_id: itemId,
        sender_batch_id: input.senderBatchId,
        payout_item_status: "SUCCESS",
      },
    });

    return { batchId, itemId, status: "SUCCESS" };
  },

  async getPayoutStatus(itemId: string): Promise<PayoutItemStatus> {
    for (const record of ledger.values()) {
      if (record.itemId === itemId) return record.status;
    }
    return "UNKNOWN";
  },

  async verifyWebhook(headers, rawBody): Promise<boolean> {
    const { PAYPAL_MOCK_WEBHOOK_SECRET } = getEnv();
    const presented = headers[SIGNATURE_HEADER];
    if (!presented) return false;
    const expected = signBody(rawBody, PAYPAL_MOCK_WEBHOOK_SECRET);
    const a = Buffer.from(presented, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return a.equals(b);
  },

  parseWebhook(rawBody): PayPalWebhookEvent {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const resource = (payload.resource ?? {}) as Record<string, unknown>;

    return {
      id: String(payload.id ?? ""),
      type: String(payload.event_type ?? ""),
      itemId: resource.payout_item_id ? String(resource.payout_item_id) : null,
      senderBatchId: resource.sender_batch_id ? String(resource.sender_batch_id) : null,
      status: resource.payout_item_status
        ? (String(resource.payout_item_status).toUpperCase() as PayoutItemStatus)
        : null,
    };
  },
};

/**
 * Post a signed webhook to our own endpoint.
 *
 * Awaited rather than fired and forgotten, because a serverless function can
 * be frozen the moment its response is sent — a fire-and-forget fetch would
 * be cut off before it landed, and the demo would appear to hang at PAYING.
 */
async function deliverWebhook(payload: Record<string, unknown>): Promise<void> {
  const { APP_URL, PAYPAL_MOCK_WEBHOOK_SECRET } = getEnv();
  const body = JSON.stringify(payload);
  const signature = signBody(body, PAYPAL_MOCK_WEBHOOK_SECRET);

  try {
    await fetch(`${APP_URL}/api/paypal/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signature },
      body,
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // The reconciler is the backstop: if this delivery does not land, the
    // next read of the bounty resolves the payout from the provider.
  }
}
