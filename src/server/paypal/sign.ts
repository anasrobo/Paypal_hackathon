/**
 * Webhook signing.
 *
 * The signature is computed over the RAW body bytes, before any parsing.
 * Parsing and re-serialising changes the bytes — key order, whitespace,
 * unicode escaping — and a signature over the re-serialised form will not
 * match. This is the single most common webhook bug.
 *
 * The comparison is constant time, so a caller cannot learn the expected
 * signature one byte at a time.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-gt-signature";

export function signBody(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifySignature(
  rawBody: string,
  presented: string | undefined,
  secret: string,
): boolean {
  if (!presented) return false;
  const expected = signBody(rawBody, secret);
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
