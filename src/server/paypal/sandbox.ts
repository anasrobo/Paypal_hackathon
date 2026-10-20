/**
 * The PayPal Sandbox provider.
 *
 * Real REST calls against the PayPal SANDBOX host. There is no code path in
 * this file that can reach a live host: the base URL is a module constant,
 * asserted to contain "sandbox" at construction time, and the only way to
 * change it is to edit this file.
 *
 * The sandbox provider is written to spec so that swapping to it is an
 * environment change, not a code change. It is not exercised by the test
 * suite, because the suite must not depend on a third party being up.
 */

import { getEnv } from "../env";
import type {
  CreatePayoutInput,
  CreatePayoutResult,
  PayPalProvider,
  PayPalWebhookEvent,
  PayoutItemStatus,
} from "./provider";

/** The only PayPal host this application may ever talk to. */
const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

if (!SANDBOX_BASE.includes("sandbox")) {
  // A build-time tripwire. If someone edits the constant to a live host,
  // the module refuses to load rather than silently moving real money.
  throw new Error("PayPal base URL must be a sandbox host.");
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = getEnv();
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required for the sandbox provider.");
  }

  // Refresh a minute before expiry rather than on the failure.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${SANDBOX_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`PayPal OAuth failed with ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return body.access_token;
}

function toItemStatus(raw: string | undefined): PayoutItemStatus {
  switch ((raw ?? "").toUpperCase()) {
    case "SUCCESS":
      return "SUCCESS";
    case "PENDING":
      return "PENDING";
    case "FAILED":
      return "FAILED";
    case "BLOCKED":
      return "BLOCKED";
    case "DENIED":
      return "DENIED";
    case "RETURNED":
      return "RETURNED";
    case "HELD":
      return "HELD";
    default:
      return "UNKNOWN";
  }
}

export const sandboxPayPal: PayPalProvider = {
  name: "sandbox",

  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    const token = await accessToken();

    const body = {
      sender_batch_header: {
        sender_batch_id: input.senderBatchId,
        email_subject: input.emailSubject,
        email_message: input.note,
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: { email: input.recipientEmail },
          amount: {
            value: (input.amountCents / 100).toFixed(2),
            currency: input.currency,
          },
          note: input.note,
          sender_item_id: input.senderBatchId,
        },
      ],
    };

    const response = await fetch(`${SANDBOX_BASE}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "paypal-request-id": input.senderBatchId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    const payload = (await response.json()) as {
      batch_header?: { payout_batch_id?: string; sender_batch_status?: string };
      items?: { payout_item_id?: string; payout_item_status?: string; errors?: { message?: string } }[];
    };

    const item = payload.items?.[0];

    if (!response.ok) {
      return {
        batchId: payload.batch_header?.payout_batch_id ?? "unknown",
        itemId: item?.payout_item_id ?? "unknown",
        status: "FAILED",
        errorMessage: item?.errors?.message ?? `PayPal returned ${response.status}`,
      };
    }

    return {
      batchId: payload.batch_header?.payout_batch_id ?? "unknown",
      itemId: item?.payout_item_id ?? "unknown",
      status: toItemStatus(item?.payout_item_status ?? payload.batch_header?.sender_batch_status),
    };
  },

  async getPayoutStatus(itemId: string): Promise<PayoutItemStatus> {
    const token = await accessToken();
    const response = await fetch(`${SANDBOX_BASE}/v1/payments/payouts/${itemId}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return "UNKNOWN";
    const payload = (await response.json()) as { payout_item_status?: string };
    return toItemStatus(payload.payout_item_status);
  },

  async verifyWebhook(headers, rawBody): Promise<boolean> {
    const { PAYPAL_WEBHOOK_ID } = getEnv();
    const transmissionId = headers["paypal-transmission-id"];
    const transmissionTime = headers["paypal-transmission-time"];
    const transmissionSig = headers["paypal-transmission-sig"];
    const certUrl = headers["paypal-cert-url"];
    const authAlgo = headers["paypal-auth-algo"];

    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !PAYPAL_WEBHOOK_ID) {
      return false;
    }

    const token = await accessToken();
    const response = await fetch(`${SANDBOX_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(rawBody),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return false;
    const payload = (await response.json()) as { verification_status?: string };
    // Fail closed: anything other than SUCCESS is a rejection.
    return payload.verification_status === "SUCCESS";
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
        ? toItemStatus(String(resource.payout_item_status))
        : null,
    };
  },
};
