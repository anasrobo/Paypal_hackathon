/**
 * The claim endpoint: accept a bounty, then submit the evidence.
 *
 * This is the moment the human earns the money. The order is deliberate:
 *
 *   1. Verify the claim token and check it belongs to a CLAIMED bounty.
 *   2. Check the submitted storage path belongs to THAT bounty.
 *   3. Move the bounty CLAIMED -> SUBMITTED.
 *   4. Record the evidence.
 *   5. Verify, which moves it SUBMITTED -> VERIFYING -> VERIFIED or REJECTED.
 *   6. Only if it is VERIFIED, pay.
 *
 * Step 6 is the only place money can move, and it cannot run for a bounty
 * that failed a single rule.
 *
 * The endpoint carries two operations, so the phone needs one URL and the
 * deployment needs one fewer function:
 *
 *   op: "accept"  POSTED -> CLAIMED. Redeems the single-use token and takes
 *                 the payee email, which is where the money is sent.
 *   op: "submit"  The evidence submission described above. The default.
 */

import { NextResponse } from "next/server";
import { AppError, statusOf, toErrorBody } from "@/domain/errors";
import { GATE_DEFAULTS } from "@/domain/gate";
import { db } from "@/server/db/client";
import { getBountyById, getPayoutByBountyId, insertEvidence, transitionBounty } from "@/server/db/queries";
import { claimBounty } from "@/server/services/bounty";
import { payVerifiedBounty } from "@/server/services/payout";
import { verifySubmission } from "@/server/services/verification";
import { verifyClaimToken } from "@/server/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface ClaimBody {
  op?: "accept" | "submit";
  token?: string;
  email?: string;
  evidencePath?: string;
  thumbPath?: string | null;
  bytes?: number;
  mime?: string;
  sha256?: string | null;
  capturedAt?: string;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
}

/**
 * Accept the bounty.
 *
 * The token is single use: redeeming it clears the stored hash, so the same
 * link cannot be accepted twice. The compare-and-swap on the status is the
 * second lock, in case two people press the button at the same moment.
 */
async function accept(body: ClaimBody) {
  if (!body.token) throw new AppError("VALIDATION_FAILED", "A claim link is required.");

  const email = (body.email ?? "").trim();
  if (!EMAIL.test(email)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "A valid email is required — that is the address the money is sent to.",
    );
  }

  const bounty = await claimBounty(body.token, email);

  return {
    success: true,
    op: "accept" as const,
    bountyId: bounty.id,
    status: bounty.status,
    claimedByEmail: bounty.claimedByEmail,
  };
}

async function submit(body: ClaimBody) {
  const sql = db();

  if (!body.token || !body.evidencePath || !body.mime || !body.bytes) {
    throw new AppError("VALIDATION_FAILED", "token, evidencePath, mime and bytes are required.");
  }
  if (!ALLOWED_MIME.has(body.mime)) {
    throw new AppError("MEDIA_INVALID_TYPE", `${body.mime} is not a supported image type.`);
  }
  if (body.bytes >= GATE_DEFAULTS.maxMediaBytes) {
    throw new AppError(
      "MEDIA_TOO_LARGE",
      `The photo must be under ${GATE_DEFAULTS.maxMediaBytes / (1024 * 1024)} MB.`,
    );
  }
  if (!body.capturedAt) {
    throw new AppError("VALIDATION_FAILED", "capturedAt is required.");
  }

  const bountyId = verifyClaimToken(body.token);
  const bounty = await getBountyById(sql, bountyId);
  if (!bounty) throw new AppError("NOT_FOUND", "This bounty no longer exists.");
  if (bounty.status !== "CLAIMED") {
    throw new AppError(
      "INVALID_STATE",
      `This bounty is ${bounty.status.toLowerCase().replace(/_/g, " ")} and cannot accept evidence.`,
    );
  }

  // The path is server-issued and must belong to this bounty. Without this
  // check a client could submit someone else's evidence.
  const expectedPrefix = `bounties/${bountyId}/`;
  if (!body.evidencePath.startsWith(expectedPrefix)) {
    throw new AppError("VALIDATION_FAILED", "That evidence does not belong to this bounty.");
  }
  if (body.thumbPath && !body.thumbPath.startsWith(expectedPrefix)) {
    throw new AppError("VALIDATION_FAILED", "That thumbnail does not belong to this bounty.");
  }

  const capturedAt = new Date(body.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) {
    throw new AppError("VALIDATION_FAILED", "capturedAt is not a valid time.");
  }

  // 1. Claim the submission, so two submissions cannot both apply.
  const submitted = await transitionBounty(sql, bountyId, "CLAIMED", "SUBMITTED");
  if (!submitted) {
    throw new AppError("CONCURRENT_TRANSITION", "This bounty was already submitted.");
  }

  // 2. Record the evidence.
  await insertEvidence(sql, {
    bountyId,
    mediaPath: body.evidencePath,
    thumbPath: body.thumbPath ?? null,
    bytes: body.bytes,
    mime: body.mime,
    sha256: body.sha256 ?? null,
    capturedAt,
    lat: body.lat ?? null,
    lon: body.lng ?? null,
    accuracyM: body.accuracyM ?? null,
  });

  // 3. Verify. This is the only thing that may produce VERIFIED.
  const outcome = await verifySubmission(bountyId);

  // 4. Pay, only if the gate passed.
  let payout = null;
  if (outcome.passed) {
    await payVerifiedBounty(bountyId);
    // Re-read the payout rather than trusting the return value: the mock
    // provider delivers its signed webhook DURING createPayout, so by now the
    // row may already be PAID. The screen shows what is true, not what was
    // true a moment ago.
    const freshPayout = await getPayoutByBountyId(sql, bountyId);
    payout = freshPayout
      ? {
          status: freshPayout.status,
          amountCents: freshPayout.amountCents,
          currency: freshPayout.currency,
          payeeEmail: freshPayout.payeeEmail,
          senderBatchId: freshPayout.senderBatchId,
          externalId: freshPayout.externalId,
        }
      : null;
  }

  const fresh = await getBountyById(sql, bountyId);

  return {
    success: true,
    op: "submit" as const,
    bountyId,
    status: fresh?.status ?? outcome.status,
    passed: outcome.passed,
    checks: outcome.checks,
    failedRuleIds: outcome.failedRuleIds,
    payout: payout
      ? {
          status: payout.status,
          amountCents: payout.amountCents,
          currency: payout.currency,
          payeeEmail: payout.payeeEmail,
          senderBatchId: payout.senderBatchId,
          externalId: payout.externalId,
        }
      : null,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClaimBody;
    if (body.op === "accept") {
      return NextResponse.json(await accept(body));
    }
    return NextResponse.json(await submit(body));
  } catch (error) {
    return NextResponse.json(toErrorBody(error), { status: statusOf(error) });
  }
}
