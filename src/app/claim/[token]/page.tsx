/**
 * The capture screen — screen 2 of 4, and the one the demo happens on.
 *
 * It is designed for a phone, at 390 px, in one hand, in a shop. Everything
 * else in the product can be read on a laptop; this must be usable in four
 * steps with a thumb.
 *
 * The page is a Server Component that resolves the claim token to its bounty.
 * The token is never trusted blindly: the signature and the expiry are
 * checked, and the single-use hash decides whether the link is still live.
 */

import { AppError } from "@/domain/errors";
import { ClaimCapture, type ClaimBountyView } from "@/components/claim/ClaimCapture";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { claimLinkState, peekBountyByToken } from "@/server/services/bounty";

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let bounty = null;
  let linkState: "valid" | "replaced" | "redeemed" = "valid";
  let problem: string | null = null;

  try {
    bounty = await peekBountyByToken(token);
    if (!bounty) {
      problem = "This bounty no longer exists.";
    } else {
      linkState = claimLinkState(bounty, token);
    }
  } catch (error) {
    problem = AppError.is(error)
      ? error.message
      : "This claim link is not valid.";
  }

  if (!bounty) {
    return (
      <div className="mx-auto max-w-md">
        <Panel>
          <PanelHeader title="This link cannot be used" />
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted">{problem}</p>
            <p className="mt-2 text-xs text-faint">
              Claim links are single use and expire. Ask the requester for a fresh one.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  const view: ClaimBountyView = {
    id: bounty.id,
    sku: bounty.sku,
    storeName: bounty.storeName,
    storeAddress: bounty.storeAddress,
    storeLat: bounty.storeLat,
    storeLng: bounty.storeLng,
    radiusM: bounty.radiusM,
    expectedValueCents: bounty.expectedValueCents,
    tolerancePct: bounty.tolerancePct,
    rewardCents: bounty.rewardCents,
    currency: bounty.currency,
    status: bounty.status,
    expiresAt: bounty.expiresAt.toISOString(),
    claimedByEmail: bounty.claimedByEmail,
  };

  return <ClaimCapture token={token} bounty={view} linkState={linkState} />;
}
