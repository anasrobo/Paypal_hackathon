/**
 * Row types.
 *
 * The connection uses `transform: postgres.camel`, so a snake_case column
 * arrives with a camelCase key. Numeric columns come back as strings, because
 * Postgres `numeric` is arbitrary precision and postgres.js does not silently
 * turn it into a float.
 */

import type { BountyStatus } from "@/domain/types";

export interface BountyRow {
  id: string;
  status: BountyStatus;
  sku: string;
  storeName: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  radiusM: number;
  expectedValueCents: number;
  tolerancePct: number;
  currency: string;
  rewardCents: number;
  requesterEmail: string;
  claimTokenHash: string | null;
  claimedByEmail: string | null;
  claimedAt: Date | null;
  submittedAt: Date | null;
  expiresAt: Date;
  evidencePath: string | null;
  evidenceThumbPath: string | null;
  evidenceBytes: number | null;
  evidenceMime: string | null;
  evidenceSha256: string | null;
  capturedAt: Date | null;
  captureLat: number | null;
  captureLng: number | null;
  captureAccuracyM: number | null;
  modelVerdict: string | null;
  /** A numeric column, so it arrives as a string. */
  modelConfidence: string | null;
  modelObservedCents: number | null;
  modelRaw: unknown;
  modelProvider: string | null;
  modelLatencyMs: number | null;
  /** Demo affordance for the mock vision provider. Null for a real one. */
  mockScenario: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidenceRow {
  id: string;
  bountyId: string;
  mediaPath: string;
  thumbPath: string | null;
  bytes: number;
  mime: string;
  sha256: string | null;
  capturedAt: Date;
  lat: number | null;
  lon: number | null;
  accuracyM: number | null;
  createdAt: Date;
}

export interface VerificationCheckRow {
  id: number;
  bountyId: string;
  ruleKey: string;
  passed: boolean;
  observed: unknown;
  expected: unknown;
  severity: string;
  createdAt: Date;
}

export type PayoutStatus = "CREATED" | "SUBMITTED" | "PAID" | "FAILED" | "BLOCKED" | "UNKNOWN";

export interface PayoutRow {
  id: string;
  bountyId: string;
  senderBatchId: string;
  status: PayoutStatus;
  amountCents: number;
  currency: string;
  payeeEmail: string;
  provider: string;
  externalId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEventRow {
  id: number;
  paypalEventId: string;
  eventType: string;
  resourceId: string | null;
  payload: unknown;
  outcome: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}

export interface AuditEventRow {
  id: number;
  bountyId: string;
  type: string;
  payload: unknown;
  createdAt: Date;
}
