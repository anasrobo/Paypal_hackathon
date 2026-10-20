/**
 * The money path.
 *
 * This is the most safety-critical file in the application. Three rules hold
 * it together:
 *
 *   1. ONLY a VERIFIED bounty can be paid. The status is checked, and the
 *      transition into PAYING is a compare-and-swap, so two concurrent
 *      requests cannot both start a payout.
 *
 *   2. THE PAYOUT ROW IS WRITTEN BEFORE THE PAYPAL CALL. The unique
 *      constraint on bounty_id is the exactly-once gate: a second attempt
 *      inserts zero rows and never reaches PayPal.
 *
 *   3. THE AMOUNT COMES FROM THE BOUNTY ROW. Never from a request body,
 *      never from a model response, never from a client.
 *
 * Failures are NEVER retried automatically. A failed payout becomes
 * PAYOUT_FAILED and a human resolves it. Auto-retry is the conventional
 * choice and it is the one that risks paying a stranger twice.
 */

import { AppError } from "@/domain/errors";
import { senderBatchId } from "@/domain/money";
import { db } from "../db/client";
import {
  getBountyById,
  getPayoutByBountyId,
  getPayoutByExternalId,
  getPayoutBySenderBatchId,
  insertAuditEvent,
  insertPayout,
  insertWebhookEvent,
  markPayoutSubmitted,
  transitionBounty,
  updatePayout,
} from "../db/queries";
import type { PayoutRow } from "../db/types";
import { getPayPalProvider, type PayPalWebhookEvent, type PayoutItemStatus } from "../paypal";

/**
 * Pay a verified bounty.
 *
 * Returns null when a payout for this bounty already exists — the
 * exactly-once gate refused it.
 */
export async function payVerifiedBounty(bountyId: string): Promise<PayoutRow | null> {
  const sql = db();

  const bounty = await getBountyById(sql, bountyId);
  if (!bounty) throw new AppError("NOT_FOUND", "This bounty no longer exists.");

  if (bounty.status !== "VERIFIED") {
    // The audit records the refusal, because "we did not pay this" is a
    // fact a judge will ask about.
    await insertAuditEvent(sql, bountyId, "payout_refused", {
      status: bounty.status,
      reason: "only a verified bounty can be paid",
    });
    throw new AppError(
      "INVALID_STATE",
      `Only a verified bounty can be paid. This one is ${bounty.status.toLowerCase().replace(/_/g, " ")}.`,
    );
  }

  if (!bounty.claimedByEmail) {
    throw new AppError("INVALID_STATE", "This bounty has nobody to pay.");
  }

  // The amount is read from the database row. Nothing else may set it.
  const amountCents = bounty.rewardCents;
  const batchId = senderBatchId(bountyId);

  // The payout row goes in FIRST. A conflict means a payout already exists
  // for this bounty, so we must not call PayPal again.
  const payout = await insertPayout(sql, {
    bountyId,
    senderBatchId: batchId,
    amountCents,
    currency: bounty.currency,
    payeeEmail: bounty.claimedByEmail,
    provider: getPayPalProvider().name,
  });

  if (!payout) {
    await insertAuditEvent(sql, bountyId, "payout_duplicate_blocked", { senderBatchId: batchId });
    return null;
  }

  // Now the bounty may enter PAYING. This is the only automatic edge into
  // PAYING, and it starts from VERIFIED.
  const paying = await transitionBounty(sql, bountyId, "VERIFIED", "PAYING");
  if (!paying) {
    await updatePayout(sql, payout.id, {
      status: "FAILED",
      errorMessage: "the bounty changed before the payout could start",
    });
    throw new AppError("CONCURRENT_TRANSITION", "This bounty changed while it was being paid.");
  }

  await insertAuditEvent(sql, bountyId, "payout_started", {
    amountCents,
    senderBatchId: batchId,
    payee: bounty.claimedByEmail,
  });

  try {
    const provider = getPayPalProvider();
    const result = await provider.createPayout({
      senderBatchId: batchId,
      amountCents,
      currency: bounty.currency,
      recipientEmail: bounty.claimedByEmail,
      emailSubject: `GroundTruth bounty ${bounty.sku}`,
      note: `Verification bounty for ${bounty.storeName}`,
    });

    if (result.status === "SUCCESS") {
      // The webhook may already have arrived and set this row to PAID. The
      // compare-and-swap means we never downgrade it.
      await markPayoutSubmitted(sql, payout.id, result.itemId);
      await insertAuditEvent(sql, bountyId, "payout_submitted", { itemId: result.itemId });
      return { ...payout, status: "SUBMITTED", externalId: result.itemId };
    }

    // The provider refused it outright. The bounty is not paid and never
    // will be, without a human.
    await updatePayout(sql, payout.id, {
      status: "FAILED",
      externalId: result.itemId,
      errorMessage: result.errorMessage ?? `provider returned ${result.status}`,
    });
    await transitionBounty(sql, bountyId, "PAYING", "PAYOUT_FAILED");
    await insertAuditEvent(sql, bountyId, "payout_failed", {
      itemId: result.itemId,
      status: result.status,
    });

    return { ...payout, status: "FAILED", externalId: result.itemId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown provider error";
    await updatePayout(sql, payout.id, { status: "FAILED", errorMessage: message });
    await transitionBounty(sql, bountyId, "PAYING", "PAYOUT_FAILED");
    await insertAuditEvent(sql, bountyId, "payout_error", { message });
    throw new AppError("PAYOUT_FAILED", `The payout could not be sent: ${message}`);
  }
}

interface EventOutcome {
  payoutStatus: PayoutRow["status"];
  bountyStatus: "PAID" | "PAYOUT_FAILED" | "PAYOUT_BLOCKED";
  paid: boolean;
}

function outcomeFor(event: PayPalWebhookEvent): EventOutcome | null {
  switch (event.type) {
    case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED":
      return { payoutStatus: "PAID", bountyStatus: "PAID", paid: true };
    case "PAYMENT.PAYOUTS-ITEM.BLOCKED":
      return { payoutStatus: "BLOCKED", bountyStatus: "PAYOUT_BLOCKED", paid: false };
    case "PAYMENT.PAYOUTS-ITEM.DENIED":
    case "PAYMENT.PAYOUTS-ITEM.FAILED":
    case "PAYMENT.PAYOUTS-ITEM.RETURNED":
    case "PAYMENT.PAYOUTS-ITEM.REFUNDED":
      return { payoutStatus: "FAILED", bountyStatus: "PAYOUT_FAILED", paid: false };
    default:
      return null;
  }
}

/**
 * Apply a verified webhook event.
 *
 * "replay" means the same PayPal event id was already processed. The insert
 * is the first thing that happens, so a replay never changes any state.
 */
export async function applyWebhookEvent(
  event: PayPalWebhookEvent,
): Promise<"applied" | "replay" | "ignored"> {
  const sql = db();

  const eventId = await insertWebhookEvent(sql, {
    paypalEventId: event.id,
    eventType: event.type,
    resourceId: event.itemId,
    payload: event,
  });

  if (eventId === null) return "replay";

  const outcome = outcomeFor(event);
  if (!outcome) {
    await sql`UPDATE webhook_events SET outcome = 'ignored', processed_at = now()
              WHERE paypal_event_id = ${event.id}`;
    return "ignored";
  }

  const payout = event.senderBatchId
    ? await getPayoutBySenderBatchId(sql, event.senderBatchId)
    : event.itemId
      ? await getPayoutByExternalId(sql, event.itemId)
      : null;

  if (!payout) {
    await sql`UPDATE webhook_events SET outcome = 'unknown_payout', processed_at = now()
              WHERE paypal_event_id = ${event.id}`;
    return "ignored";
  }

  await updatePayout(sql, payout.id, {
    status: outcome.payoutStatus,
    paidAt: outcome.paid ? new Date() : undefined,
    errorMessage: outcome.paid ? undefined : `payout ${outcome.payoutStatus.toLowerCase()}`,
  });

  await transitionBounty(sql, payout.bountyId, "PAYING", outcome.bountyStatus);

  await insertAuditEvent(sql, payout.bountyId, `payout_${outcome.bountyStatus.toLowerCase()}`, {
    eventId: event.id,
    itemId: event.itemId,
  });

  await sql`UPDATE webhook_events SET outcome = 'applied', processed_at = now()
            WHERE paypal_event_id = ${event.id}`;

  return "applied";
}

/** Read the current payout for a bounty, for the evidence screen. */
export async function getPayout(bountyId: string): Promise<PayoutRow | null> {
  return getPayoutByBountyId(db(), bountyId);
}

/** Map a provider status onto a bounty status. Used by the reconciler. */
export function bountyStatusForProviderStatus(
  status: PayoutItemStatus,
): "PAID" | "PAYOUT_FAILED" | "PAYOUT_BLOCKED" | null {
  switch (status) {
    case "SUCCESS":
      return "PAID";
    case "BLOCKED":
    case "HELD":
      return "PAYOUT_BLOCKED";
    case "FAILED":
    case "DENIED":
    case "RETURNED":
      return "PAYOUT_FAILED";
    default:
      return null;
  }
}
