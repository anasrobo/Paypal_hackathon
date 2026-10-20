"use client";

/**
 * The poller.
 *
 * While a bounty is in flight — submitted, verifying, paying — the screen
 * refreshes itself on a backoff, because a judge should not have to press
 * anything to watch the money arrive.
 *
 * It STOPS. After a bounded number of attempts it offers a Refresh button
 * instead of spinning forever. A spinner that never resolves is worse than a
 * button, because it makes the page look broken rather than busy.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** The delays between attempts, in milliseconds. */
const BACKOFF = [1_000, 2_000, 4_000, 8_000, 15_000];

export function StatusPoller({ watching }: { watching: boolean }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [stopped, setStopped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!watching) return;

    if (attempt >= BACKOFF.length) {
      setStopped(true);
      return;
    }

    timer.current = setTimeout(() => {
      router.refresh();
      setAttempt((value) => value + 1);
    }, BACKOFF[attempt]);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [attempt, watching, router]);

  if (!watching) return null;

  if (stopped) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-faint">
        <span>Still waiting on PayPal.</span>
        <button
          type="button"
          onClick={() => {
            setAttempt(0);
            setStopped(false);
            router.refresh();
          }}
          className="rounded border border-line px-2 py-0.5 text-text transition-colors hover:border-money/50 hover:text-money"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[11px] text-faint">
      <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
      <span>Waiting for the payout to settle…</span>
    </div>
  );
}
