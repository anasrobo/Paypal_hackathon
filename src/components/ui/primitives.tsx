/**
 * The primitive set.
 *
 * Hand-written rather than generated, because the product needs a very
 * specific look: a dense, calm instrument panel. Near-black surfaces,
 * hairline borders, monospaced tabular numbers, and exactly one accent
 * colour reserved for money.
 *
 * The rules the whole product follows:
 *   - Numbers are monospaced and right aligned, always.
 *   - A colour means something. Green is money. Amber is in flight. Red is
 *     blocked. Blue is information. Nothing is coloured for decoration.
 *   - Every surface state exists: empty, loading, error, and the normal
 *     case. A missing state is a missing feature, not a detail.
 */

import * as React from "react";
import { cn } from "./cn";

// ------------------------------------------------------------------ Button

type ButtonVariant = "primary" | "default" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-money text-ink hover:bg-money/90 active:bg-money/80 font-medium border border-money",
  default:
    "bg-overlay text-text border border-line hover:border-line-strong hover:bg-line/40",
  ghost: "bg-transparent text-muted border border-transparent hover:text-text hover:bg-overlay",
  danger:
    "bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

// ------------------------------------------------------------------- Panel

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel", className)} {...props}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-text">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-faint">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------- Badge

type Tone = "neutral" | "money" | "warn" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-overlay text-muted border-line",
  money: "bg-money/10 text-money border-money/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  info: "bg-info/10 text-info border-info/30",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-none",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// -------------------------------------------------------------- StatusPill

const STATUS_TONE: Record<string, Tone> = {
  POSTED: "info",
  CLAIMED: "info",
  SUBMITTED: "info",
  VERIFYING: "warn",
  VERIFIED: "money",
  REJECTED: "danger",
  PAYING: "warn",
  PAID: "money",
  PAYOUT_FAILED: "danger",
  PAYOUT_BLOCKED: "danger",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} className="font-mono uppercase">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

// ------------------------------------------------------------------- Money

export function Money({
  cents,
  currency = "USD",
  className,
  tone = "default",
}: {
  cents: number | null | undefined;
  currency?: string;
  className?: string;
  tone?: "default" | "money" | "muted";
}) {
  if (cents === null || cents === undefined) {
    return <span className={cn("num text-faint", className)}>—</span>;
  }
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  const abs = Math.abs(cents);
  const text = `${cents < 0 ? "-" : ""}${symbol}${(abs / 100).toFixed(2)}`;
  return (
    <span
      className={cn(
        "num",
        tone === "money" && "text-money",
        tone === "muted" && "text-muted",
        className,
      )}
    >
      {text}
    </span>
  );
}

// ------------------------------------------------------------------- Field

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label block">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-[11px] text-faint">{hint}</span> : null}
    </label>
  );
}

const INPUT_CLASS =
  "w-full rounded-md border border-line bg-ink px-2.5 py-2 text-sm text-text " +
  "placeholder:text-faint focus:border-money focus:outline-none";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(INPUT_CLASS, className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(INPUT_CLASS, "resize-y", className)} {...props} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(INPUT_CLASS, className)} {...props}>
      {children}
    </select>
  );
});

// -------------------------------------------------------------- EmptyState

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-sm text-muted">{title}</p>
      {detail ? <p className="max-w-sm text-xs text-faint">{detail}</p> : null}
      {action}
    </div>
  );
}

// -------------------------------------------------------------------- Stat

export function Stat({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "money" | "danger" | "warn";
  hint?: string;
}) {
  return (
    <div className="px-4 py-3">
      <p className="label">{label}</p>
      <p
        className={cn(
          "num mt-1 text-xl leading-none",
          tone === "money" && "text-money",
          tone === "danger" && "text-danger",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-faint">{hint}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------------ Toggle

export function RuleRow({
  passed,
  label,
  expected,
  actual,
  detail,
}: {
  /** null means the rule has not been evaluated yet. */
  passed: boolean | null;
  label: string;
  expected: string;
  actual: string;
  detail?: string;
}) {
  const tone =
    passed === null
      ? "border-line-strong bg-overlay text-faint"
      : passed
        ? "border-money/50 bg-money/15 text-money"
        : "border-danger/50 bg-danger/15 text-danger";
  const mark = passed === null ? "·" : passed ? "✓" : "✕";

  return (
    <div className="flex items-start gap-3 border-b border-line/60 px-4 py-2.5 last:border-0">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none",
          tone,
        )}
      >
        {mark}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-sm text-text">{label}</span>
          <span className="num text-xs text-muted">
            {actual} <span className="text-faint">/ {expected}</span>
          </span>
        </div>
        {detail ? <p className="mt-0.5 text-[11px] text-faint">{detail}</p> : null}
      </div>
    </div>
  );
}
