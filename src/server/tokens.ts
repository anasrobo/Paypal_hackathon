/**
 * Claim tokens.
 *
 * A claim token is the link a human receives. It must be:
 *   - unforgeable (HMAC-SHA256 over a payload)
 *   - single use (the hash is nulled on redemption)
 *   - expiring (the expiry is inside the signed payload)
 *
 * The raw token is NEVER stored. Only its SHA-256 goes in the database, so a
 * database leak does not hand out working claim links.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "@/domain/errors";
import { getEnv } from "./env";

export interface ClaimTokenPayload {
  /** The bounty this token claims. */
  b: string;
  /** Expiry, epoch milliseconds. */
  e: number;
  /** A random nonce, so two tokens for the same bounty differ. */
  n: string;
}

const TTL_MS = 1000 * 60 * 60 * 24 * 7; // seven days

function b64url(input: Buffer): string {
  return input.toString("base64url");
}

function sign(payload: string): string {
  const { TOKEN_SECRET } = getEnv();
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
}

/** The value stored in the database. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issue a fresh claim token and the hash to store against the bounty. */
export function issueClaimToken(
  bountyId: string,
  now: Date = new Date(),
): { token: string; hash: string; expiresAt: Date } {
  const payload: ClaimTokenPayload = {
    b: bountyId,
    e: now.getTime() + TTL_MS,
    n: randomBytes(8).toString("hex"),
  };
  const encoded = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const token = `${encoded}.${sign(encoded)}`;
  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(payload.e),
  };
}

/**
 * Verify a claim token and return the bounty it belongs to.
 *
 * Throws rather than returning null, so a caller cannot forget to check.
 */
export function verifyClaimToken(token: string, now: Date = new Date()): string {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new AppError("INVALID_TOKEN", "This claim link is not valid.");
  }

  const [encoded, signature] = parts;
  const expected = sign(encoded);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("INVALID_TOKEN", "This claim link is not valid.");
  }

  let payload: ClaimTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new AppError("INVALID_TOKEN", "This claim link is not valid.");
  }

  if (!payload || typeof payload.b !== "string" || typeof payload.e !== "number") {
    throw new AppError("INVALID_TOKEN", "This claim link is not valid.");
  }

  if (payload.e < now.getTime()) {
    throw new AppError("TOKEN_EXPIRED", "This claim link has expired.");
  }

  return payload.b;
}

/** Constant-time comparison of a presented token against a stored hash. */
export function tokenMatchesHash(token: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const presented = Buffer.from(hashToken(token));
  const stored = Buffer.from(storedHash);
  if (presented.length !== stored.length) return false;
  return timingSafeEqual(presented, stored);
}
