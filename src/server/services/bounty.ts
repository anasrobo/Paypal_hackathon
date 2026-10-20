/**
 * Bounty lifecycle.
 *
 * Creating, listing and claiming. Everything that changes a status goes
 * through the compare-and-swap in `db/queries.ts` and the transition table
 * in `domain/state-machine.ts`, so an illegal move is impossible rather than
 * merely discouraged.
 */

import { randomUUID } from "node:crypto";
import { AppError } from "@/domain/errors";
import { isValidPayoutAmount } from "@/domain/money";
import { db } from "../db/client";
import {
  findBountyByTokenHash,
  getBountyById,
  insertAuditEvent,
  insertBounty,
  listBounties,
  transitionBounty,
  updateBounty,
} from "../db/queries";
import type { BountyRow } from "../db/types";
import { hashToken, issueClaimToken, verifyClaimToken } from "../tokens";

export interface CreateBountyInput {
  sku: string;
  storeName: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  radiusM: number;
  expectedValueCents: number;
  tolerancePct: number;
  currency: string;
  rewardCents: number;
  requesterEmail: string;
  expiresAt: Date;
  /** Demo affordance for the mock vision provider. */
  mockScenario: string | null;
}

export async function createBounty(input: CreateBountyInput): Promise<{
  bounty: BountyRow;
  claimToken: string;
}> {
  if (!isValidPayoutAmount(input.rewardCents)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "The reward must be between $0.01 and $1,000.00.",
    );
  }
  if (input.expectedValueCents <= 0) {
    throw new AppError("VALIDATION_FAILED", "The expected price must be positive.");
  }

  const sql = db();

  // The id is generated here rather than by the database, because the claim
  // token is signed over it and both must be written in a single insert.
  const id = randomUUID();
  const { token, hash } = issueClaimToken(id);

  const bounty = await insertBounty(sql, { id, ...input, claimTokenHash: hash });

  await insertAuditEvent(sql, bounty.id, "created", {
    sku: input.sku,
    rewardCents: input.rewardCents,
  });

  return { bounty, claimToken: token };
}

export async function listRecentBounties(limit = 100): Promise<BountyRow[]> {
  return listBounties(db(), limit);
}

export async function getBounty(id: string): Promise<BountyRow | null> {
  return getBountyById(db(), id);
}

/**
 * Claim a bounty with a claim link.
 *
 * The token is verified for its signature and expiry, then matched against
 * the stored hash. The hash is cleared on redemption, so a link can be used
 * exactly once.
 */
export async function claimBounty(
  token: string,
  humanEmail: string,
  now: Date = new Date(),
): Promise<BountyRow> {
  const sql = db();

  const bountyId = verifyClaimToken(token, now);
  const bounty = await getBountyById(sql, bountyId);
  if (!bounty) throw new AppError("NOT_FOUND", "This bounty no longer exists.");

  if (bounty.claimTokenHash === null) {
    throw new AppError("TOKEN_ALREADY_USED", "This claim link has already been used.");
  }
  if (bounty.status !== "POSTED") {
    throw new AppError(
      "INVALID_STATE",
      `This bounty is ${bounty.status.toLowerCase().replace(/_/g, " ")} and cannot be claimed.`,
    );
  }
  if (bounty.expiresAt.getTime() < now.getTime()) {
    throw new AppError("TOKEN_EXPIRED", "This bounty has expired.");
  }

  const claimed = await transitionBounty(sql, bounty.id, "POSTED", "CLAIMED");
  if (!claimed) {
    throw new AppError("CONCURRENT_TRANSITION", "Someone claimed this bounty first.");
  }

  await updateBounty(sql, bounty.id, { claimedByEmail: humanEmail, claimedAt: now });
  await sql`UPDATE bounties SET claim_token_hash = NULL WHERE id = ${bounty.id}`;
  await insertAuditEvent(sql, bounty.id, "claimed", { humanEmail });

  const fresh = await getBountyById(sql, bounty.id);
  return fresh ?? claimed;
}

/** Resolve a claim token to its bounty without redeeming it. */
export async function peekBountyByToken(token: string): Promise<BountyRow | null> {
  const sql = db();
  const bountyId = verifyClaimToken(token);
  const bounty = await getBountyById(sql, bountyId);
  if (!bounty) return null;
  const stored = await findBountyByTokenHash(sql, hashToken(token));
  return stored ? bounty : null;
}
