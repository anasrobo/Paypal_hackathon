/**
 * The ops ledger API.
 *
 * Server-paginated and server-filtered, because the AG Grid Community
 * build cannot use the Server-Side Row Model. The `infinite` row model asks
 * for a page of rows, and this route returns exactly that.
 *
 * The whole table is never shipped to the browser. The SQL is built by
 * `src/ops/ledger-query.ts`, which whitelists every sortable and filterable
 * column, so a user-supplied string can only ever be a bound value.
 *
 * The reconciler also runs here. A judge looking at the ledger IS the
 * trigger, which is a better timer than a daily cron.
 */

import { NextResponse } from "next/server";
import { statusOf, toErrorBody } from "@/domain/errors";
import { db } from "@/server/db/client";
import { buildLedgerQuery, parseLedgerQuery } from "@/ops/ledger-query";
import { reconcileStuckPayouts } from "@/server/services/reconcile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = parseLedgerQuery(params);

    // The sweep runs first, so a judge sees the truth rather than a stale
    // PAYING row. It is one indexed UPDATE against a partial index.
    await reconcileStuckPayouts();

    const built = buildLedgerQuery(query);
    const sql = db();

    const [rows, countRows] = await Promise.all([
      // The values are always bound parameters built by the whitelisted
      // query builder, never interpolated SQL.
      sql.unsafe(built.rowsText, built.rowsValues as never[]),
      sql.unsafe(built.countText, built.countValues as never[]),
    ]);

    const count = Array.isArray(countRows) && countRows.length ? Number(countRows[0].count) : 0;

    return NextResponse.json({
      success: true,
      rows: rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        sku: row.sku,
        storeName: row.storeName,
        status: row.status,
        modelVerdict: row.modelVerdict,
        modelConfidence: row.modelConfidence,
        expectedValueCents: row.expectedValueCents,
        modelObservedCents: row.modelObservedCents,
        rewardCents: row.rewardCents,
        claimedByEmail: row.claimedByEmail,
        requesterEmail: row.requesterEmail,
        createdAt: row.createdAt,
        paidAt: row.paidAt,
        evidenceThumbPath: row.evidenceThumbPath,
        mockScenario: row.mockScenario,
        payoutStatus: row.payoutStatus,
        senderBatchId: row.senderBatchId,
        payoutPaidAt: row.payoutPaidAt,
      })),
      total: count,
      lastRow: built.offset + built.limit >= count ? count : undefined,
    });
  } catch (error) {
    return NextResponse.json(toErrorBody(error), { status: statusOf(error) });
  }
}
