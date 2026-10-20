"use server";

/**
 * Server Actions for the requester console.
 *
 * A Server Action is the right tool for the two things the console does:
 * create a bounty, and hand out a claim link. Both mutate the database, both
 * need the server's trust boundary, and neither needs a public HTTP surface.
 *
 * The claim link is the interesting one. Only the HASH of a claim token is
 * stored, so a link can never be recovered from the database. That means the
 * only way to show a link again is to issue a new one — and issuing a new one
 * invalidates the old one, which is the correct behaviour for a link that
 * carries the right to be paid.
 */

import { revalidatePath } from "next/cache";
import { AppError } from "@/domain/errors";
import { parseCents } from "@/domain/money";
import { claimUrl } from "@/server/http";
import {
  createBounty as createBountyService,
  reissueClaimToken,
} from "@/server/services/bounty";
import type { MockScenario } from "@/server/vision";

export interface CreateBountyState {
  ok: boolean;
  error?: string;
  bountyId?: string;
  /** The absolute claim link, shown once, to be sent to a human. */
  link?: string;
  sku?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SCENARIOS: MockScenario[] = ["match", "mismatch", "low_confidence", "unreadable"];

export async function createBountyAction(
  _previous: CreateBountyState,
  formData: FormData,
): Promise<CreateBountyState> {
  const text = (name: string) => (formData.get(name) ?? "").toString().trim();
  const number = (name: string) => Number(text(name));

  const sku = text("sku");
  const storeName = text("storeName");
  const storeAddress = text("storeAddress");
  const requesterEmail = text("requesterEmail");
  const expectedValueCents = parseCents(text("expectedValue"));
  const rewardCents = parseCents(text("reward"));
  const storeLat = number("storeLat");
  const storeLng = number("storeLng");
  const radiusM = number("radiusM") || 250;
  const tolerancePct = number("tolerancePct") || 10;
  const expiresInHours = Math.min(number("expiresInHours") || 24, 24 * 14);
  const rawScenario = text("mockScenario");

  if (!sku) return { ok: false, error: "A SKU is required." };
  if (!storeName) return { ok: false, error: "The store name is required." };
  if (!storeAddress) return { ok: false, error: "The store address is required." };
  if (!EMAIL.test(requesterEmail)) {
    return { ok: false, error: "A valid requester email is required." };
  }
  if (!Number.isFinite(storeLat) || storeLat < -90 || storeLat > 90) {
    return { ok: false, error: "The store latitude is not a valid coordinate." };
  }
  if (!Number.isFinite(storeLng) || storeLng < -180 || storeLng > 180) {
    return { ok: false, error: "The store longitude is not a valid coordinate." };
  }
  if (expectedValueCents === null || expectedValueCents <= 0) {
    return { ok: false, error: "The expected price must be a positive amount." };
  }
  if (rewardCents === null || rewardCents <= 0) {
    return { ok: false, error: "The reward must be a positive amount." };
  }

  const scenario = (SCENARIOS as string[]).includes(rawScenario)
    ? (rawScenario as MockScenario)
    : null;

  try {
    const { bounty, claimToken } = await createBountyService({
      sku,
      storeName,
      storeAddress,
      storeLat,
      storeLng,
      radiusM,
      expectedValueCents,
      tolerancePct,
      currency: "USD",
      rewardCents,
      requesterEmail,
      expiresAt: new Date(Date.now() + expiresInHours * 3_600_000),
      mockScenario: scenario,
    });

    revalidatePath("/");

    return {
      ok: true,
      bountyId: bounty.id,
      link: await claimUrl(claimToken),
      sku,
    };
  } catch (error) {
    if (AppError.is(error)) return { ok: false, error: error.message };
    return { ok: false, error: "The bounty could not be created. Please try again." };
  }
}

export interface ClaimLinkResult {
  ok: boolean;
  link?: string;
  error?: string;
}

/**
 * Generate a fresh claim link for a bounty that has not been claimed yet.
 *
 * The previous link stops working the moment this returns, because the stored
 * hash is replaced. There is no way to have two live links to one bounty, and
 * therefore no way for two people to claim the same reward.
 */
export async function reissueClaimLinkAction(bountyId: string): Promise<ClaimLinkResult> {
  try {
    const token = await reissueClaimToken(bountyId);
    return { ok: true, link: await claimUrl(token) };
  } catch (error) {
    if (AppError.is(error)) return { ok: false, error: error.message };
    return { ok: false, error: "The claim link could not be generated." };
  }
}
