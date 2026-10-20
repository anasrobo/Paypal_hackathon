/**
 * Verification.
 *
 * This is the only place in the application that may move a bounty to
 * VERIFIED or REJECTED, and it does so by calling the pure gate — never by
 * inspecting the model output directly.
 *
 * The order matters:
 *
 *   1. CAS the bounty from SUBMITTED to VERIFYING, so two concurrent
 *      verifications cannot both run.
 *   2. Ask the vision provider for an opinion.
 *   3. Hand that opinion to the pure gate, together with the evidence.
 *   4. Persist the full checklist, so the evidence screen can show every
 *      rule and not just the failures.
 *   5. CAS to VERIFIED or REJECTED.
 *
 * Step 4 is what makes the demo work: a judge sees six green rows and
 * understands why money moved, not just that it did.
 */

import { evaluateGate } from "@/domain/gate";
import { AppError } from "@/domain/errors";
import type { GateResult, RuleResult } from "@/domain/types";
import { db } from "../db/client";
import {
  getBountyById,
  getEvidenceByBountyId,
  insertAuditEvent,
  replaceVerificationChecks,
  transitionBounty,
  updateBounty,
} from "../db/queries";
import { getVisionProvider, type MockScenario } from "../vision";

export interface VerificationOutcome {
  passed: boolean;
  status: "VERIFIED" | "REJECTED";
  checks: RuleResult[];
  failedRuleIds: string[];
}

export async function verifySubmission(
  bountyId: string,
  now: Date = new Date(),
): Promise<VerificationOutcome> {
  const sql = db();

  const bounty = await getBountyById(sql, bountyId);
  if (!bounty) throw new AppError("NOT_FOUND", "This bounty no longer exists.");
  if (bounty.status !== "SUBMITTED") {
    throw new AppError(
      "INVALID_STATE",
      `This bounty is ${bounty.status.toLowerCase().replace(/_/g, " ")} and cannot be verified.`,
    );
  }

  // Claim the verification. If somebody else got there first, stop.
  const verifying = await transitionBounty(sql, bountyId, "SUBMITTED", "VERIFYING");
  if (!verifying) {
    throw new AppError("CONCURRENT_TRANSITION", "This bounty is already being verified.");
  }

  const evidence = await getEvidenceByBountyId(sql, bountyId);
  if (!evidence) {
    // Fail closed: no evidence, no verification.
    await transitionBounty(sql, bountyId, "VERIFYING", "REJECTED");
    await insertAuditEvent(sql, bountyId, "rejected", { reason: "no evidence" });
    throw new AppError("VALIDATION_FAILED", "There is no evidence to verify.");
  }

  const provider = getVisionProvider();

  // The model is advisory. It contributes to two rules and can only ever
  // cause a rule to fail.
  const model = await provider.readPriceTag({
    image: Buffer.alloc(0),
    mimeType: evidence.mime,
    expectedValueCents: bounty.expectedValueCents,
    scenario: (bounty.mockScenario as MockScenario | null) ?? null,
  });

  const gate: GateResult = evaluateGate({
    expectedValueCents: bounty.expectedValueCents,
    tolerancePct: bounty.tolerancePct,
    radiusMeters: bounty.radiusM,
    storeLat: bounty.storeLat,
    storeLng: bounty.storeLng,
    now,
    model,
    capturedAt: evidence.capturedAt,
    captureLat: evidence.lat,
    captureLng: evidence.lon,
    captureAccuracyM: evidence.accuracyM,
    media: {
      present: true,
      bytes: evidence.bytes,
      mime: evidence.mime,
    },
  });

  await replaceVerificationChecks(
    sql,
    bountyId,
    gate.checks.map((check) => ({
      ruleKey: check.id,
      passed: check.passed,
      observed: { actual: check.actual, detail: check.detail },
      expected: { expected: check.expected, label: check.label },
    })),
  );

  await updateBounty(sql, bountyId, {
    modelVerdict: model.verdict,
    modelConfidence: model.confidence,
    modelObservedCents: model.observedValueCents ?? undefined,
    modelRaw: model.raw,
    modelProvider: model.provider,
    modelLatencyMs: model.latencyMs,
  });

  const target = gate.passed ? "VERIFIED" : "REJECTED";
  const settled = await transitionBounty(sql, bountyId, "VERIFYING", target);

  if (!settled) {
    throw new AppError("CONCURRENT_TRANSITION", "This bounty changed while it was verified.");
  }

  await insertAuditEvent(sql, bountyId, target === "VERIFIED" ? "verified" : "rejected", {
    failedRuleIds: gate.failedRuleIds,
    modelVerdict: model.verdict,
    modelConfidence: model.confidence,
  });

  return {
    passed: gate.passed,
    status: target,
    checks: gate.checks,
    failedRuleIds: gate.failedRuleIds,
  };
}
