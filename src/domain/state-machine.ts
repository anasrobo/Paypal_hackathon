/**
 * The bounty state machine.
 *
 * PURE: no I/O, no clock, no environment.
 *
 * This table is the single source of truth for what a bounty may become. The
 * application enforces it with a compare-and-swap UPDATE, and Postgres
 * enforces it again with a trigger, so an illegal transition is rejected even
 * if some future code path forgets to check.
 *
 * The important edges:
 *
 *   VERIFIED -> PAYING      the ONLY automatic entry into PAYING
 *   PAYING   -> PAID | PAYOUT_FAILED | PAYOUT_BLOCKED
 *
 * A failed payout may be re-driven by an operator, and that re-drive is
 * audited. It is deliberately NOT an automatic transition: a retry after a
 * failure is a human decision, because the alternative is paying a stranger
 * twice.
 */

import { AppError } from "./errors";
import type { BountyStatus } from "./types";

export const TRANSITIONS: Readonly<Record<BountyStatus, readonly BountyStatus[]>> = {
  POSTED: ["CLAIMED", "EXPIRED", "CANCELLED"],
  CLAIMED: ["SUBMITTED", "EXPIRED", "CANCELLED"],
  SUBMITTED: ["VERIFYING"],
  VERIFYING: ["VERIFIED", "REJECTED"],
  VERIFIED: ["PAYING"],
  REJECTED: [],
  PAYING: ["PAID", "PAYOUT_FAILED", "PAYOUT_BLOCKED"],
  PAID: [],
  PAYOUT_FAILED: ["PAYING"],
  PAYOUT_BLOCKED: ["PAYING"],
  EXPIRED: [],
  CANCELLED: [],
};

/** Statuses from which nothing further can happen. */
export const TERMINAL_STATUSES: readonly BountyStatus[] = [
  "REJECTED",
  "PAID",
  "EXPIRED",
  "CANCELLED",
];

/**
 * Transitions that may only be performed by an operator, never by the
 * automatic pipeline.
 */
const OPERATOR_ONLY: ReadonlySet<string> = new Set(["PAYOUT_FAILED->PAYING", "PAYOUT_BLOCKED->PAYING"]);

export type TransitionKind = "automatic" | "operator-retry";

export function nextStatuses(from: BountyStatus): readonly BountyStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isTerminal(status: BountyStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Is this transition legal at all, regardless of who performs it? */
export function canTransition(
  from: BountyStatus,
  to: BountyStatus,
  kind: TransitionKind = "automatic",
): boolean {
  if (!TRANSITIONS[from]?.includes(to)) return false;
  if (kind === "automatic" && OPERATOR_ONLY.has(`${from}->${to}`)) return false;
  return true;
}

/**
 * Assert that a transition is legal, or throw.
 *
 * Throwing rather than returning false means a caller cannot forget to check.
 */
export function assertTransition(
  from: BountyStatus,
  to: BountyStatus,
  kind: TransitionKind = "automatic",
): void {
  if (canTransition(from, to, kind)) return;

  if (OPERATOR_ONLY.has(`${from}->${to}`)) {
    throw new AppError(
      "ILLEGAL_TRANSITION",
      `A ${from} bounty can only be re-driven by an operator, not automatically.`,
    );
  }

  const allowed = nextStatuses(from);
  throw new AppError(
    "ILLEGAL_TRANSITION",
    allowed.length === 0
      ? `A ${from} bounty is final and cannot become ${to}.`
      : `A ${from} bounty cannot become ${to}. Allowed: ${allowed.join(", ")}.`,
  );
}

/**
 * The statuses the automatic pipeline is allowed to reach from here.
 * Used by the service layer to assert before writing.
 */
export function automaticTargets(from: BountyStatus): readonly BountyStatus[] {
  return nextStatuses(from).filter((to) => canTransition(from, to, "automatic"));
}
