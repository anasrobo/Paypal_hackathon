/**
 * The ops ledger — screen 4 of 4.
 *
 * The page itself is a static shell: the grid fetches its rows from the API
 * with the infinite row model, so the page needs no database access and costs
 * no serverless function. Everything a judge looks at is loaded after the
 * page paints, and the first paint is instant.
 */

import type { Metadata } from "next";
import { OpsLedgerGrid } from "@/components/ops/OpsLedgerGrid";

export const metadata: Metadata = {
  title: "Ops ledger — GroundTruth",
  description:
    "Every bounty, every rule result and every payout, in one server-paginated ledger.",
};

export default function OpsPage() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="label">Operations</p>
        <h1 className="text-2xl font-medium tracking-tight text-text">The ledger</h1>
        <p className="max-w-2xl text-sm text-muted">
          Every bounty, the model&apos;s opinion, the six rule results, and the payout — in one
          table. Rows are paged from the server, so the table never travels to the browser whole.
        </p>
      </header>

      <OpsLedgerGrid />
    </div>
  );
}
