"use client";

/**
 * The error boundary.
 *
 * It exists so that a failure is a DESIGNED screen rather than a stack trace.
 * A judge who hits an error should still be looking at a calm instrument
 * panel, with a way forward, not at a white page.
 */

import { useEffect } from "react";
import { Button, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server logs the real stack. The client only gets a safe message.
    console.error("GroundTruth page error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md">
      <Panel>
        <PanelHeader title="Something went wrong" />
        <EmptyState
          title="This page could not be loaded"
          detail="The error has been logged. If the problem persists, the database may be briefly unreachable — try again in a moment."
          action={
            <div className="mt-2 flex items-center gap-2">
              <Button onClick={reset}>Try again</Button>
              <Button variant="ghost" onClick={() => window.location.assign("/")}>
                Back to the console
              </Button>
            </div>
          }
        />
        {error.digest ? (
          <p className="num border-t border-line px-4 py-2 text-[10px] text-faint">
            reference {error.digest}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
