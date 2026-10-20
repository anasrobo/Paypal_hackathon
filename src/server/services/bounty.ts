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
  getBountyById,
  insertAuditEvent,
  insertBounty,
  listBounties,
  transitionBounty,
  updateBounty,
} from "../db/queries";
import type { BountyRow } from "../db/types";
import { issueClaimToken, tokenMatchesHash, verifyClaimToken } from "../tokens";

export interface CreateBountyInput {
  /**
   * A fixed id. The seed uses it so a demo row keeps the same link every
   * time it is re-seeded. The application leaves it undefined and gets a
   * random UUID.
   */
  id?: string;
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
  const id = input.id ?? randomUUID();
  const { token, hash } = issueClaimToken(id);

  const bounty = await insertBounty(sql, {
    id,
    sku: input.sku,
    storeName: input.storeName,
    storeAddress: input.storeAddress,
    storeLat: input.storeLat,
    storeLng: input.storeLng,
    radiusM: input.radiusM,
    expectedValueCents: input.expectedValueCents,
    tolerancePct: input.tolerancePct,
    currency: input.currency,
    rewardCents: input.rewardCents,
    requesterEmail: input.requesterEmail,
    claimTokenHash: hash,
    expiresAt: input.expiresAt,
    mockScenario: input.mockScenario,
  });

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
  // The presented token must be the one that was issued for this bounty. This
  // is what makes a REGENERATED link invalidate the previous one: the stored
  // hash changes, so the old token no longer matches and can never be redeemed.
  if (!tokenMatchesHash(token, bounty.claimTokenHash)) {
    throw new AppError("INVALID_TOKEN", "This claim link is not valid.");
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

/**
 * Resolve a claim token to its bounty WITHOUT redeeming it.
 *
 * The signature and the expiry are checked, but the single-use hash is not.
 * That distinction matters: once a human has accepted, the stored hash is
 * cleared, and the page still has to be able to show them the capture screen.
 */
export async function peekBountyByToken(token: string): Promise<BountyRow | null> {
  const bountyId = verifyClaimToken(token);
  return getBountyById(db(), bountyId);
}

export type ClaimLinkState = "valid" | "replaced" | "redeemed";

/**
 * Is the presented claim link still the live one for this bounty?
 *
 * "replaced" means a newer link was generated, so this one is dead. "redeemed"
 * means somebody has already accepted it. The capture page uses this to say
 * something useful instead of showing a generic failure.
 */
export function claimLinkState(bounty: BountyRow, token: string): ClaimLinkState {
  if (bounty.claimTokenHash === null) return "redeemed";
  if (!tokenMatchesHash(token, bounty.claimTokenHash)) return "replaced";
  return "valid";
}

/**
 * Issue a fresh claim token for a bounty that has not been claimed yet.
 *
 * Only the HASH of the token is stored, so a claim link can never be recovered
 * from the database. Regenerating is therefore the only way to show a link
 * again — and it is a real product affordance: a requester whose link was lost
 * can ask for a new one, and the old one stops working at the same moment.
 */
export async function reissueClaimToken(bountyId: string): Promise<string> {
  const sql = db();

  const bounty = await getBountyById(sql, bountyId);
  if (!bounty) throw new AppError("NOT_FOUND", "This bounty no longer exists.");
  if (bounty.status !== "POSTED") {
    throw new AppError(
      "INVALID_STATE",
      `This bounty is ${bounty.status.toLowerCase().replace(/_/g, " ")} and no longer has a claim link.`,
    );
  }

  const { token, hash } = issueClaimToken(bountyId);
  await sql`UPDATE bounties SET claim_token_hash = ${hash}, updated_at = now() WHERE id = ${bountyId}`;
  await insertAuditEvent(sql, bountyId, "claim_link_reissued", {});

  return token;
}
