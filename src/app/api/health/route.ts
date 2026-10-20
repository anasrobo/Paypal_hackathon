/**
 * Health.
 *
 * One URL that answers "is the demo alive?". The rehearsal script and the
 * judge-facing insurance both hit this.
 *
 * A database outage returns 503 with "degraded", following the convention
 * from the user's own production project, so a monitoring system and a
 * human read the same answer.
 */

import { NextResponse } from "next/server";
import { ping } from "@/server/db/client";
import { getPayPalProvider } from "@/server/paypal";
import { getVisionProvider } from "@/server/vision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const dbUp = await ping();

  const body = {
    status: dbUp ? "ok" : "degraded",
    db: dbUp ? "up" : "down",
    provider: getPayPalProvider().name,
    vision: getVisionProvider().name,
    version: process.env.npm_package_version ?? "0.1.0",
    at: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: dbUp ? 200 : 503 });
}
