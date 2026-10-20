"use client";

/**
 * The live bounty list.
 *
 * The interesting button is "Claim link". Only the HASH of a claim token is
 * stored, so a link can never be read back out of the database — it has to be
 * issued on demand. Pressing the button issues a new one and copies it, and
 * the previous link stops working at the same instant. One live link per
 * bounty, therefore one person can claim each reward.
 */

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { reissueClaimLinkAction } from "@/server/actions/bounties";
import {
  Button,
  EmptyState,
  Money,
  Panel,
  PanelHeader,
  StatusPill,
} from "@/components/ui/primitives";

export interface BountySummary {
  id: string;
  sku: string;
  storeName: string;
  storeAddress: string;
  status: string;
  rewardCents: number;
  currency: string;
  expectedValueCents: number;
  createdAt: string;
  claimedByEmail: string | null;
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Renders an absolute timestamp on the server and a relative one after mount.
 *
 * A relative time computed during the server render would be a hydration
 * mismatch, because the client computes it a fraction of a second later. This
 * renders the same string on both sides for the first paint, then upgrades.
 */
function TimeAgo({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(relativeTime(iso));
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [iso]);

  return (
    <span className="num text-[11px] text-faint" title={iso}>
      {label ?? iso.slice(5, 16).replace("T", " ")}
    </span>
  );
}

export function BountyList({ bounties }: { bounties: BountySummary[] }) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function issueLink(id: string) {
    setPendingId(id);
    startTransition(async () => {
      try {
        const result = await reissueClaimLinkAction(id);
        if (!result.ok || !result.link) {
          setErrors((previous) => ({
            ...previous,
            [id]: result.error ?? "The claim link could not be generated.",
          }));
          return;
        }
        setErrors((previous) => {
          const next = { ...previous };
          delete next[id];
          return next;
        });
        setLinks((previous) => ({ ...previous, [id]: result.link as string }));
        try {
          await navigator.clipboard.writeText(result.link);
          setCopiedId(id);
        } catch {
          setCopiedId(null);
        }
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <Panel className="flex h-fit flex-col">
      <PanelHeader
        title="Live bounties"
        hint={
          bounties.length === 0
            ? "Nothing posted yet"
            : `${bounties.length} most recent · new money in, decisions out`
        }
      />

      {bounties.length === 0 ? (
        <EmptyState
          title="No bounties yet"
          detail="Post one and the claim link appears immediately. Send it to someone near the store."
        />
      ) : (
        <ul className="divide-y divide-line">
          {bounties.map((bounty) => {
            const link = links[bounty.id];
            return (
              <li key={bounty.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2">
                      <span className="num text-sm text-text">{bounty.sku}</span>
                      <span className="truncate text-xs text-muted">{bounty.storeName}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-faint">{bounty.storeAddress}</p>
                  </div>
                  <StatusPill status={bounty.status} />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-faint">
                  <span>
                    reward{" "}
                    <Money cents={bounty.rewardCents} currency={bounty.currency} className="text-xs" />
                  </span>
                  <span>
                    expects{" "}
                    <Money
                      cents={bounty.expectedValueCents}
                      currency={bounty.currency}
                      className="text-xs"
                    />
                  </span>
                  {bounty.claimedByEmail ? (
                    <span className="truncate">paid to {bounty.claimedByEmail}</span>
                  ) : null}
                  <TimeAgo iso={bounty.createdAt} />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {bounty.status === "POSTED" ? (
                    <Button
                      size="sm"
                      onClick={() => issueLink(bounty.id)}
                      disabled={pendingId === bounty.id}
                    >
                      {pendingId === bounty.id
                        ? "Generating…"
                        : copiedId === bounty.id
                          ? "Copied"
                          : "Copy claim link"}
                    </Button>
                  ) : null}
                  <Link
                    href={`/bounty/${bounty.id}`}
                    className="text-[11px] text-muted underline-offset-2 transition-colors hover:text-money hover:underline"
                  >
                    open evidence →
                  </Link>
                </div>

                {link ? (
                  <input
                    readOnly
                    value={link}
                    aria-label={`Claim link for ${bounty.sku}`}
                    onFocus={(event) => event.currentTarget.select()}
                    className="num mt-2 w-full rounded border border-line bg-ink px-2 py-1.5 text-[11px] text-text"
                  />
                ) : null}

                {errors[bounty.id] ? (
                  <p className="mt-2 text-[11px] text-danger">{errors[bounty.id]}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
