/**
 * The reconciler.
 *
 * Vercel Hobby runs cron at most once a day, so it cannot drive a
 * 60-second sweep. The sweep is therefore PULL-BASED: it runs opportunistically
 * at the top of the reads a judge is already making, backed by a daily cron.
 *
 * The judge looking at the screen IS the trigger. A mechanism that "sometimes
 * fires" is worse than one that always does, and this one costs one indexed
 * UPDATE against a partial index.
 */

import { db } from "../db/client";
import {
  getBountyById,
  insertAuditEvent,
  listStuckPayouts,
  markPayoutSubmitted,
  transitionBounty,
  updatePayout,
} from "../db/queries";
import { senderBatchId } from "@/domain/money";
import { getPayPalProvider } from "../paypal";
import { bountyStatusForProviderStatus } from "./payout";

const STUCK_AFTER_MS = 60_000;

export interface ReconcileResult {
  scanned: number;
  resolved: number;
  pending: number;
}

/**
 * Resolve payouts that are stuck in PAYING.
 *
 * Two cases:
 *
 *   - The provider gave us an item id, so ask the provider what happened.
 *
 *   - The process died BETWEEN the database insert and the PayPal call, so
 *     there is no item id. The payout is re-driven with the SAME
 *     deterministic sender_batch_id. That is safe precisely because the key
 *     is deterministic: PayPal returns the original batch instead of
 *     creating a second one, and the mock provider behaves the same way.
 */
export async function reconcileStuckPayouts(now: Date = new Date()): Promise<ReconcileResult> {
  const sql = db();
  const provider = getPayPalProvider();

  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);
  const stuck = await listStuckPayouts(sql, cutoff);

  let resolved = 0;
  let pending = 0;

  for (const payout of stuck) {
    const bounty = await getBountyById(sql, payout.bountyId);
    if (!bounty || bounty.status !== "PAYING") continue;

    let externalId = payout.externalId;

    if (!externalId) {
      // The process died before it could record the provider's item id.
      // Re-drive with the same idempotency key.
      try {
        const result = await provider.createPayout({
          senderBatchId: payout.senderBatchId || senderBatchId(payout.bountyId),
          amountCents: payout.amountCents,
          currency: payout.currency,
          recipientEmail: payout.payeeEmail,
          emailSubject: `GroundTruth bounty ${bounty.sku}`,
          note: `Verification bounty for ${bounty.storeName}`,
        });
        await markPayoutSubmitted(sql, payout.id, result.itemId);
        await insertAuditEvent(sql, payout.bountyId, "payout_redriven", {
          itemId: result.itemId,
          reason: "no external id was recorded",
        });
        externalId = result.itemId;
      } catch (error) {
        await updatePayout(sql, payout.id, {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "redrive failed",
        });
        await transitionBounty(sql, payout.bountyId, "PAYING", "PAYOUT_FAILED");
        resolved += 1;
        continue;
      }
    }

    // Now ask the provider what actually happened.
    if (!externalId) {
      pending += 1;
      continue;
    }
    const status = await provider.getPayoutStatus(externalId);
    const target = bountyStatusForProviderStatus(status);

    if (!target) {
      pending += 1;
      continue;
    }

    await updatePayout(sql, payout.id, {
      status: target === "PAID" ? "PAID" : target === "PAYOUT_BLOCKED" ? "BLOCKED" : "FAILED",
      paidAt: target === "PAID" ? now : undefined,
    });
    await transitionBounty(sql, payout.bountyId, "PAYING", target);
    await insertAuditEvent(sql, payout.bountyId, `payout_${target.toLowerCase()}`, {
      via: "reconciler",
      providerStatus: status,
    });
    resolved += 1;
  }

  return { scanned: stuck.length, resolved, pending };
}

/**
 * A cheap database ping.
 *
 * This is the daily keepalive. A free Supabase project is paused after a
 * period of inactivity, and the judging window is 1–15 December — long after
 * the submission. A daily ping keeps it alive so the demo URL is never dead
 * when a judge opens it.
 */
export async function keepAlive(): Promise<boolean> {
  try {
    await db()`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
