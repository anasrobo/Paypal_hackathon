/**
 * Signed upload URLs.
 *
 * The browser never sends image bytes through a function. It asks for a
 * signed upload URL here, then PUTs the photo straight to Supabase Storage.
 *
 * Two consequences that matter:
 *   - The 4.5 MB Vercel request-body limit becomes irrelevant, so a photo
 *     is not degraded to fit through a function.
 *   - The function only ever handles small JSON.
 *
 * The path is SERVER-ISSUED and tied to the bounty, so the claim route can
 * insist that a submitted path belongs to the bounty it claims. A client
 * cannot point the app at someone else's evidence.
 */

import { NextResponse } from "next/server";
import { AppError, statusOf, toErrorBody } from "@/domain/errors";
import { GATE_DEFAULTS } from "@/domain/gate";
import { db } from "@/server/db/client";
import { getBountyById } from "@/server/db/queries";
import { evidencePath, supabaseStorage } from "@/server/storage";
import { verifyClaimToken } from "@/server/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      kind?: "full" | "thumb";
      contentType?: string;
      bytes?: number;
    };

    if (!body.token || !body.kind || !body.contentType) {
      throw new AppError("VALIDATION_FAILED", "token, kind and contentType are required.");
    }

    const extension = EXTENSIONS[body.contentType];
    if (!extension) {
      throw new AppError("MEDIA_INVALID_TYPE", `${body.contentType} is not a supported image type.`);
    }

    if (
      typeof body.bytes === "number" &&
      body.bytes >= GATE_DEFAULTS.maxMediaBytes
    ) {
      throw new AppError(
        "MEDIA_TOO_LARGE",
        `The photo must be under ${GATE_DEFAULTS.maxMediaBytes / (1024 * 1024)} MB.`,
      );
    }

    const bountyId = verifyClaimToken(body.token);
    const bounty = await getBountyById(db(), bountyId);
    if (!bounty) throw new AppError("NOT_FOUND", "This bounty no longer exists.");
    if (bounty.status !== "CLAIMED") {
      throw new AppError(
        "INVALID_STATE",
        `This bounty is ${bounty.status.toLowerCase().replace(/_/g, " ")} and cannot accept evidence.`,
      );
    }

    const path = evidencePath(bountyId, body.kind, extension);
    const signed = await supabaseStorage.createSignedUpload(path, body.contentType);

    return NextResponse.json({
      success: true,
      signedUrl: signed.signedUrl,
      path: signed.path,
      token: signed.token,
      expiresIn: 7200,
    });
  } catch (error) {
    return NextResponse.json(toErrorBody(error), { status: statusOf(error) });
  }
}
