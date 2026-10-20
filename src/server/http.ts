/**
 * Request-scoped helpers.
 *
 * This module exists for one reason: a claim link has to be ABSOLUTE. It is
 * handed to a phone, not rendered on the page it came from, so "the link you
 * are reading" and "the link you paste into a message" must be the same string.
 *
 * Building the origin from the incoming request means a preview deployment
 * produces a preview link, and production produces a production link, without
 * any configuration. `APP_URL` is the fallback for a context with no request.
 */

import { headers } from "next/headers";
import { getEnv } from "./env";

/** The absolute origin this request arrived on, without a trailing slash. */
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return getEnv().APP_URL.replace(/\/+$/, "");

  const forwardedProto = h.get("x-forwarded-proto");
  const proto =
    forwardedProto ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${proto}://${host}`;
}

/** The absolute claim URL for a raw claim token. */
export async function claimUrl(token: string): Promise<string> {
  return `${await appOrigin()}/claim/${token}`;
}
