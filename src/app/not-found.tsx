import Link from "next/link";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md">
      <Panel>
        <PanelHeader title="Not found" />
        <EmptyState
          title="There is nothing here"
          detail="The bounty may have been removed, or the link may have been mistyped. A bounty that has been claimed still exists — try the link you were sent."
          action={
            <Link
              href="/"
              className="mt-2 rounded-md border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-money/40 hover:text-money"
            >
              Back to the console
            </Link>
          }
        />
      </Panel>
    </div>
  );
}
