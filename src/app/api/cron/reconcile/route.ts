/**
 * The cron endpoint.
 *
 * Two jobs, one route:
 *
 *   /api/cron/reconcile            resolve payouts stuck in PAYING
 *   /api/cron/reconcile?op=keepalive  a cheap database ping
 *
 * The keepalive matters more than it looks. A free Supabase project is
 * paused after a period of inactivity, and the judging window is 1–15
 * December — long after the submission. A daily ping keeps the demo alive
 * so the URL is never dead when a judge opens it.
 *
 * Vercel Hobby runs cron at most once a day, so the 60-second reconciler
 * is NOT cron-driven. It runs in-process when a judge looks at a bounty.
 * This endpoint is the backstop.
 */

import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import { keepAlive, reconcileStuckPayouts } from "@/server/services/reconcile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { CRON_SECRET } = getEnv();
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!presented || presented !== CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Bad cron secret." } },
      { status: 401 },
    );
  }

  const op = new URL(request.url).searchParams.get("op");

  if (op === "keepalive") {
    const alive = await keepAlive();
    return NextResponse.json(
      { success: alive, op: "keepalive", db: alive ? "up" : "down" },
      { status: alive ? 200 : 503 },
    );
  }

  const result = await reconcileStuckPayouts();
  return NextResponse.json({ success: true, op: "reconcile", ...result });
}
