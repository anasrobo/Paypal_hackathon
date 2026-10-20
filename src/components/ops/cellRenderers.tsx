"use client";

/**
 * The custom cell renderers.
 *
 * These are the reason the ops screen exists. A grid of raw column values is
 * a spreadsheet; a grid with a verdict badge, a state pill, a signed
 * thumbnail of the actual evidence and an end-to-end latency is an
 * instrument panel.
 *
 * Every renderer is pure and presentational. The data is already on the row.
 */

import type { ICellRendererParams } from "ag-grid-community";
import { Money, StatusPill } from "@/components/ui/primitives";

const VERDICT_TONE: Record<string, "money" | "danger" | "warn" | "neutral"> = {
  match: "money",
  mismatch: "danger",
  unreadable: "warn",
};

function CellShell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="flex h-full items-center px-3" title={title}>
      {children}
    </div>
  );
}

/** The bounty state, as a pill. */
export function StatusCell(params: ICellRendererParams) {
  const status = String(params.value ?? "");
  if (!status) return <CellShell>—</CellShell>;
  return (
    <CellShell>
      <StatusPill status={status} />
    </CellShell>
  );
}

/** What the model said — advisory, so it is coloured like a hint, not a fact. */
export function VerdictCell(params: ICellRendererParams) {
  const verdict = params.value ? String(params.value) : null;
  if (!verdict) {
    return (
      <CellShell>
        <span className="num text-[11px] text-faint">not read</span>
      </CellShell>
    );
  }
  const tone = VERDICT_TONE[verdict] ?? "neutral";
  const classes: Record<string, string> = {
    money: "bg-money/10 text-money border-money/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    neutral: "bg-overlay text-muted border-line",
  };
  return (
    <CellShell>
      <span
        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-none ${classes[tone]}`}
      >
        {verdict}
      </span>
    </CellShell>
  );
}

/** An amount. The reward is the only one that gets the money colour. */
export function MoneyCell(params: ICellRendererParams) {
  const field = params.colDef?.field;
  const value = params.value === null || params.value === undefined ? null : Number(params.value);
  const isReward = field === "rewardCents";
  return (
    <CellShell>
      <span className="flex w-full justify-end">
        <Money
          cents={value}
          tone={isReward ? "money" : "default"}
          className={isReward ? "text-[13px]" : "text-[13px] text-muted"}
        />
      </span>
    </CellShell>
  );
}

/** A monospaced cell, for identifiers and timestamps. */
export function MonoCell(params: ICellRendererParams) {
  const value = params.value;
  if (value === null || value === undefined || value === "") {
    return (
      <CellShell>
        <span className="num text-[11px] text-faint">—</span>
      </CellShell>
    );
  }
  return (
    <CellShell>
      <span className="num text-[12px] text-muted">{String(value)}</span>
    </CellShell>
  );
}

/**
 * The evidence thumbnail.
 *
 * The URL is signed and short-lived, and the image is lazily loaded, so a page
 * of fifty rows does not fetch fifty photographs the operator never looks at.
 */
export function EvidenceCell(params: ICellRendererParams) {
  const url = params.value ? String(params.value) : null;
  if (!url) {
    return (
      <CellShell>
        <span className="num text-[11px] text-faint">none</span>
      </CellShell>
    );
  }
  return (
    <CellShell>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Evidence thumbnail"
        loading="lazy"
        className="h-8 w-8 rounded border border-line object-cover"
      />
    </CellShell>
  );
}

/**
 * End-to-end latency: from the bounty being posted to the money landing.
 *
 * This is the number that says whether the product is real. A judge wants to
 * see that a verification and a payout happen in seconds, not hours.
 */
export function LatencyCell(params: ICellRendererParams) {
  const data = params.data as { createdAt?: string; payoutPaidAt?: string | null } | undefined;
  if (!data?.createdAt || !data.payoutPaidAt) {
    return (
      <CellShell>
        <span className="num text-[11px] text-faint">—</span>
      </CellShell>
    );
  }
  const ms = new Date(data.payoutPaidAt).getTime() - new Date(data.createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return (
      <CellShell>
        <span className="num text-[11px] text-faint">—</span>
      </CellShell>
    );
  }
  const seconds = ms / 1000;
  const label = seconds < 1 ? `${ms} ms` : seconds < 60 ? `${seconds.toFixed(1)} s` : `${Math.round(seconds / 60)} min`;
  return (
    <CellShell>
      <span className="num text-[12px] text-money">{label}</span>
    </CellShell>
  );
}
