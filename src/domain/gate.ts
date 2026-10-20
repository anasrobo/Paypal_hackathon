/**
 * The verification gate.
 *
 * PURE: no I/O, no clock, no environment, no randomness. The server's time is
 * injected as `now`, so every rule is deterministic and testable.
 *
 * Six rules. All six always run and all six are always returned, so the
 * evidence screen can show a complete green/red checklist rather than a
 * single verdict.
 *
 * THE MODEL IS ADVISORY. It contributes to exactly two rules
 * (`model_verdict_match` and `model_confidence_min`) and can only ever cause
 * a rule to fail. There is no code path anywhere in which a model output
 * produces a VERIFIED bounty. `evaluateGate` is the only thing in the
 * application that may do that.
 *
 * EVERYTHING FAILS CLOSED. A missing, null or malformed input fails its
 * rule. It is never skipped, never defaulted to "pass".
 */

import { distanceMetersOrNull } from "./geo";
import { withinTolerance } from "./money";
import type { GateInput, GateResult, ModelOutput, RuleId, RuleResult } from "./types";

export const GATE_DEFAULTS = {
  minConfidence: 0.75,
  maxCaptureAgeMs: 30 * 60_000,
  /** A capture timestamp further in the future than this is rejected. */
  maxFutureSkewMs: 5 * 60_000,
  maxMediaBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as readonly string[],
} as const;

const LABELS: Record<RuleId, string> = {
  model_verdict_match: "The model read a matching price",
  model_confidence_min: "Model confidence is high enough",
  freshness_30m: "Photo was taken in the last 30 minutes",
  geo_250m: "You are at the store",
  value_tolerance_10pct: "The price is within tolerance",
  media_valid: "The photo is a valid image under 10 MB",
};

function modelVerdictRule(model: ModelOutput | null): RuleResult {
  const actual = model?.verdict ?? "no model output";
  const passed = model !== null && model.verdict === "match";
  return {
    id: "model_verdict_match",
    label: LABELS.model_verdict_match,
    passed,
    expected: "match",
    actual,
    detail: passed
      ? `The model read a price that matches the request.`
      : model === null
        ? `No model output was available, so this rule could not pass.`
        : `The model read "${actual}" instead of "match".`,
  };
}

function modelConfidenceRule(model: ModelOutput | null): RuleResult {
  const raw = model?.confidence;
  const hasConfidence = raw !== undefined && raw !== null && Number.isFinite(raw);
  const passed = hasConfidence && raw >= GATE_DEFAULTS.minConfidence;
  return {
    id: "model_confidence_min",
    label: LABELS.model_confidence_min,
    passed,
    expected: `>= ${GATE_DEFAULTS.minConfidence}`,
    actual: hasConfidence ? raw.toFixed(2) : "no confidence",
    detail: passed
      ? `Confidence ${raw.toFixed(2)} is at or above ${GATE_DEFAULTS.minConfidence}.`
      : hasConfidence
        ? `Confidence ${raw.toFixed(2)} is below ${GATE_DEFAULTS.minConfidence}.`
        : `No confidence value was available, so this rule could not pass.`,
  };
}

function freshnessRule(input: GateInput): RuleResult {
  const { now, capturedAt } = input;
  if (capturedAt === null) {
    return {
      id: "freshness_30m",
      label: LABELS.freshness_30m,
      passed: false,
      expected: "<= 30 min old",
      actual: "no capture time",
      detail: `The submission carried no capture timestamp, so this rule could not pass.`,
    };
  }

  const ageMs = now.getTime() - capturedAt.getTime();
  const ageMinutes = ageMs / 60_000;
  const tooOld = ageMs > GATE_DEFAULTS.maxCaptureAgeMs;
  const tooFarInFuture = ageMs < -GATE_DEFAULTS.maxFutureSkewMs;
  const passed = !tooOld && !tooFarInFuture;

  return {
    id: "freshness_30m",
    label: LABELS.freshness_30m,
    passed,
    expected: "<= 30 min old",
    actual: `${ageMinutes.toFixed(1)} min old`,
    detail: tooFarInFuture
      ? `The capture time is more than 5 minutes in the future, which suggests a wrong device clock.`
      : tooOld
        ? `The photo is ${(ageMinutes / 60).toFixed(1)} hours old. Evidence must be current.`
        : `The photo was taken ${ageMinutes.toFixed(1)} minutes ago.`,
  };
}

function geoRule(input: GateInput): RuleResult {
  const { captureLat, captureLng, captureAccuracyM, radiusMeters } = input;

  if (captureLat === null || captureLng === null) {
    return {
      id: "geo_250m",
      label: LABELS.geo_250m,
      passed: false,
      expected: `<= ${radiusMeters} m from the store`,
      actual: "no location",
      detail: `No location was supplied with the submission, so this rule could not pass.`,
    };
  }

  // A fix that is itself less accurate than the radius cannot prove the
  // radius. Fail closed.
  if (captureAccuracyM === null || captureAccuracyM > radiusMeters) {
    return {
      id: "geo_250m",
      label: LABELS.geo_250m,
      passed: false,
      expected: `<= ${radiusMeters} m from the store`,
      actual: captureAccuracyM === null ? "accuracy unknown" : `+/- ${Math.round(captureAccuracyM)} m`,
      detail:
        captureAccuracyM === null
          ? `The location fix reported no accuracy, so it could not be trusted.`
          : `The location fix is only accurate to ${Math.round(captureAccuracyM)} m, which is too coarse to prove you are within ${radiusMeters} m.`,
    };
  }

  const distance = distanceMetersOrNull(
    { lat: captureLat, lng: captureLng },
    { lat: input.storeLat, lng: input.storeLng },
  );

  if (distance === null) {
    return {
      id: "geo_250m",
      label: LABELS.geo_250m,
      passed: false,
      expected: `<= ${radiusMeters} m from the store`,
      actual: "unusable coordinates",
      detail: `The coordinates supplied could not be interpreted, so this rule could not pass.`,
    };
  }

  const passed = distance <= radiusMeters;

  return {
    id: "geo_250m",
    label: LABELS.geo_250m,
    passed,
    expected: `<= ${radiusMeters} m from the store`,
    actual: `${Math.round(distance)} m away`,
    detail: passed
      ? `You are ${Math.round(distance)} m from the store, inside the ${radiusMeters} m radius.`
      : `You are ${Math.round(distance)} m from the store, outside the ${radiusMeters} m radius.`,
  };
}

function valueRule(input: GateInput): RuleResult {
  const { expectedValueCents, tolerancePct, model } = input;
  const observed = model?.observedValueCents ?? null;
  const passed = withinTolerance(observed, expectedValueCents, tolerancePct);

  const observedText =
    observed === null ? "no observed value" : `${(observed / 100).toFixed(2)}`;
  const expectedText = `${(expectedValueCents / 100).toFixed(2)}`;

  return {
    id: "value_tolerance_10pct",
    label: LABELS.value_tolerance_10pct,
    passed,
    expected: `${expectedText} +/- ${tolerancePct}%`,
    actual: observedText,
    detail: passed
      ? `The tag reads ${observedText}, which is within ${tolerancePct}% of ${expectedText}.`
      : observed === null
        ? `The model did not read a price, so this rule could not pass.`
        : `The tag reads ${observedText}, which is outside ${tolerancePct}% of ${expectedText}.`,
  };
}

function mediaRule(input: GateInput): RuleResult {
  const { media } = input;
  const mimeOk =
    media.mime !== null && GATE_DEFAULTS.allowedMimeTypes.includes(media.mime);
  const sizeOk = media.bytes !== null && media.bytes > 0 && media.bytes < GATE_DEFAULTS.maxMediaBytes;
  const passed = media.present && mimeOk && sizeOk;

  const sizeText =
    media.bytes === null
      ? "unknown size"
      : `${(media.bytes / (1024 * 1024)).toFixed(2)} MB`;

  return {
    id: "media_valid",
    label: LABELS.media_valid,
    passed,
    expected: `image, < ${GATE_DEFAULTS.maxMediaBytes / (1024 * 1024)} MB`,
    actual: `${media.mime ?? "no file"} — ${sizeText}`,
    detail: !media.present
      ? `No photo was attached.`
      : !mimeOk
        ? `"${media.mime}" is not a supported image type.`
        : !sizeOk
          ? `The photo is ${sizeText}, which is at or over the limit.`
          : `The photo is a valid ${media.mime} of ${sizeText}.`,
  };
}

/**
 * Evaluate every rule and return the full checklist.
 *
 * `passed` is true only when all six rules passed.
 */
export function evaluateGate(input: GateInput): GateResult {
  const checks: RuleResult[] = [
    modelVerdictRule(input.model),
    modelConfidenceRule(input.model),
    freshnessRule(input),
    geoRule(input),
    valueRule(input),
    mediaRule(input),
  ];

  const failedRuleIds = checks.filter((c) => !c.passed).map((c) => c.id);

  return {
    passed: failedRuleIds.length === 0,
    checks,
    failedRuleIds,
  };
}
