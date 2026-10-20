/**
 * The PayPal webhook.
 *
 * This is the only route in the application that accepts a body from
 * outside. It is written to be hostile:
 *
 *   1. The RAW body is read first, before any parsing. A signature is
 *      computed over bytes, and re-serialising a parsed object changes
 *      them, so parsing first would break every signature.
 *   2. The signature is verified before anything is read from the payload.
 *      An unverified event is rejected with 401 and changes nothing.
 *   3. The event id is inserted FIRST. A duplicate inserts zero rows and
 *      is a no-op, so a replayed webhook can never move money twice.
 *   4. A verified event always returns 200, even when it is ignored, so
 *      PayPal does not retry-storm a duplicate.
 */

import { NextResponse } from "next/server";
import { getPayPalProvider } from "@/server/paypal";
import { applyWebhookEvent } from "@/server/services/payout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();

  const provider = getPayPalProvider();

  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  let verified: boolean;
  try {
    verified = await provider.verifyWebhook(headers, raw);
  } catch {
    verified = false;
  }

  if (!verified) {
    // Nothing is trusted, so nothing is written.
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid signature." } },
      { status: 401 },
    );
  }

  let event;
  try {
    event = provider.parseWebhook(raw);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_FAILED", message: "Unreadable event." } },
      { status: 400 },
    );
  }

  if (!event.id) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_FAILED", message: "Missing event id." } },
      { status: 400 },
    );
  }

  const outcome = await applyWebhookEvent(event);

  // Always 200 for a verified event. A duplicate is not an error, and
  // telling PayPal to retry it would only produce the same duplicate.
  return NextResponse.json({ success: true, outcome });
}
