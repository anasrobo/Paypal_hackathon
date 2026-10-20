/**
 * Domain types.
 *
 * PURE: no I/O, no clock, no environment, no framework. See AGENTS.md.
 */

export const BOUNTY_STATUSES = [
  "POSTED",
  "CLAIMED",
  "SUBMITTED",
  "VERIFYING",
  "VERIFIED",
  "REJECTED",
  "PAYING",
  "PAID",
  "PAYOUT_FAILED",
  "PAYOUT_BLOCKED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type BountyStatus = (typeof BOUNTY_STATUSES)[number];

/** The only verdict a vision provider may return. */
export type ModelVerdict = "match" | "mismatch" | "unreadable";

/**
 * What the vision provider returns. Advisory only — this feeds two of the six
 * gate rules and can never, on its own, produce a VERIFIED bounty.
 */
export interface ModelOutput {
  verdict: ModelVerdict;
  /** 0..1 */
  confidence: number;
  /** The price the model read off the tag, in cents. */
  observedValueCents: number | null;
  /** Free text or structured output from the provider, kept for the evidence view. */
  raw: unknown;
  provider: string;
  model: string;
  latencyMs: number;
}

export const RULE_IDS = [
  "model_verdict_match",
  "model_confidence_min",
  "freshness_30m",
  "geo_250m",
  "value_tolerance_10pct",
  "media_valid",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export interface RuleResult {
  id: RuleId;
  /** Human label shown in the evidence checklist. */
  label: string;
  passed: boolean;
  /** What the rule required, as text. */
  expected: string;
  /** What was actually observed, as text. */
  actual: string;
  /** One sentence explaining the outcome. */
  detail: string;
}

export interface MediaInfo {
  present: boolean;
  bytes: number | null;
  mime: string | null;
}

export interface GateInput {
  /** The price the requester expects to see on the tag, in cents. */
  expectedValueCents: number;
  /** Allowed percentage deviation. */
  tolerancePct: number;
  /** Allowed distance from the store, in metres. */
  radiusMeters: number;
  /** Where the store is. The capture is measured against this. */
  storeLat: number;
  storeLng: number;
  /** The server's current time. Injected, never read from the clock. */
  now: Date;
  model: ModelOutput | null;
  capturedAt: Date | null;
  captureLat: number | null;
  captureLng: number | null;
  /** Reported accuracy of the GPS fix, in metres. */
  captureAccuracyM: number | null;
  media: MediaInfo;
}

export interface GateResult {
  /** True only when every blocking rule passed. */
  passed: boolean;
  /** Every rule, passed or failed, in a fixed order. */
  checks: RuleResult[];
  failedRuleIds: RuleId[];
}

/** A payout attempt, as the app sees it. */
export interface PayoutSummary {
  id: string;
  bountyId: string;
  amountCents: number;
  currency: string;
  payeeEmail: string;
  status: "CREATED" | "SUBMITTED" | "PAID" | "FAILED" | "BLOCKED" | "UNKNOWN";
  senderBatchId: string;
  externalId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  paidAt: Date | null;
}
