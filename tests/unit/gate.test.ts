import { describe, expect, it } from "vitest";
import { GATE_DEFAULTS, evaluateGate } from "@/domain/gate";
import { RULE_IDS } from "@/domain/types";
import { NOW, STORE_LAT, STORE_LNG, offsetNorth, perfectInput, perfectModel } from "./fixtures";

/** Look up one rule's result by id. */
function rule(result: ReturnType<typeof evaluateGate>, id: string) {
  const found = result.checks.find((c) => c.id === id);
  if (!found) throw new Error(`no rule ${id} in the checklist`);
  return found;
}

describe("the verification gate", () => {
  it("passes a perfect submission", () => {
    const result = evaluateGate(perfectInput());
    expect(result.passed).toBe(true);
    expect(result.failedRuleIds).toEqual([]);
  });

  it("always returns every rule, in a fixed order, passed or failed", () => {
    const result = evaluateGate(
      perfectInput({ model: null, media: { present: false, bytes: null, mime: null } }),
    );
    expect(result.checks.map((c) => c.id)).toEqual([...RULE_IDS]);
    expect(result.checks).toHaveLength(6);
    // A rule that failed is still present, so the UI can show a full checklist.
    expect(result.checks.every((c) => typeof c.passed === "boolean")).toBe(true);
  });

  it("gives every rule a label, an expectation, an actual value and a sentence", () => {
    const result = evaluateGate(perfectInput());
    for (const check of result.checks) {
      expect(check.label.length).toBeGreaterThan(0);
      expect(check.expected.length).toBeGreaterThan(0);
      expect(check.actual.length).toBeGreaterThan(0);
      expect(check.detail.length).toBeGreaterThan(0);
    }
  });

  // ---- rule 1: the model verdict -------------------------------------------

  it("fails when the model says mismatch", () => {
    const result = evaluateGate(perfectInput({ model: perfectModel({ verdict: "mismatch" }) }));
    expect(result.passed).toBe(false);
    expect(rule(result, "model_verdict_match").passed).toBe(false);
  });

  it("fails when the model says unreadable", () => {
    const result = evaluateGate(perfectInput({ model: perfectModel({ verdict: "unreadable" }) }));
    expect(rule(result, "model_verdict_match").passed).toBe(false);
  });

  // ---- rule 2: confidence ---------------------------------------------------

  it("accepts confidence exactly at the threshold and rejects just below it", () => {
    expect(rule(evaluateGate(perfectInput({ model: perfectModel({ confidence: 0.75 }) })), "model_confidence_min").passed).toBe(true);
    expect(rule(evaluateGate(perfectInput({ model: perfectModel({ confidence: 0.749 }) })), "model_confidence_min").passed).toBe(false);
  });

  it("fails closed on a non-numeric confidence", () => {
    const result = evaluateGate(
      perfectInput({ model: perfectModel({ confidence: Number.NaN }) }),
    );
    expect(rule(result, "model_confidence_min").passed).toBe(false);
  });

  // ---- rule 3: freshness ----------------------------------------------------

  it("accepts a capture 29 minutes old and rejects one 31 minutes old", () => {
    const fresh = evaluateGate(
      perfectInput({ capturedAt: new Date(NOW.getTime() - 29 * 60_000) }),
    );
    const stale = evaluateGate(
      perfectInput({ capturedAt: new Date(NOW.getTime() - 31 * 60_000) }),
    );
    expect(rule(fresh, "freshness_30m").passed).toBe(true);
    expect(rule(stale, "freshness_30m").passed).toBe(false);
  });

  it("rejects a capture timestamp more than five minutes in the future", () => {
    const result = evaluateGate(
      perfectInput({ capturedAt: new Date(NOW.getTime() + 6 * 60_000) }),
    );
    expect(rule(result, "freshness_30m").passed).toBe(false);
    expect(rule(result, "freshness_30m").detail).toMatch(/future/i);
  });

  it("fails closed when there is no capture timestamp", () => {
    const result = evaluateGate(perfectInput({ capturedAt: null }));
    expect(rule(result, "freshness_30m").passed).toBe(false);
  });

  // ---- rule 4: geofence -----------------------------------------------------

  it("accepts a capture 249 m away and rejects one 251 m away", () => {
    const inside = evaluateGate(
      perfectInput({ captureLat: offsetNorth(STORE_LAT, 249) }),
    );
    const outside = evaluateGate(
      perfectInput({ captureLat: offsetNorth(STORE_LAT, 251) }),
    );
    expect(rule(inside, "geo_250m").passed).toBe(true);
    expect(rule(outside, "geo_250m").passed).toBe(false);
  });

  it("fails closed when the location is missing", () => {
    const result = evaluateGate(perfectInput({ captureLat: null, captureLng: null }));
    expect(rule(result, "geo_250m").passed).toBe(false);
    expect(rule(result, "geo_250m").actual).toBe("no location");
  });

  it("rejects a GPS fix whose own accuracy is coarser than the radius", () => {
    const result = evaluateGate(
      perfectInput({ captureLat: STORE_LAT, captureLng: STORE_LNG, captureAccuracyM: 400 }),
    );
    expect(rule(result, "geo_250m").passed).toBe(false);
    expect(rule(result, "geo_250m").detail).toMatch(/too coarse/i);
  });

  it("rejects an unknown GPS accuracy rather than assuming it is fine", () => {
    const result = evaluateGate(perfectInput({ captureAccuracyM: null }));
    expect(rule(result, "geo_250m").passed).toBe(false);
  });

  // ---- rule 5: value tolerance ---------------------------------------------

  it("accepts a price 9 % away and rejects one 11 % away", () => {
    const near = evaluateGate(perfectInput({ model: perfectModel({ observedValueCents: 654 }) }));
    const far = evaluateGate(perfectInput({ model: perfectModel({ observedValueCents: 666 }) }));
    expect(rule(near, "value_tolerance_10pct").passed).toBe(true);
    expect(rule(far, "value_tolerance_10pct").passed).toBe(false);
  });

  it("fails closed when the model read no price", () => {
    const result = evaluateGate(perfectInput({ model: perfectModel({ observedValueCents: null }) }));
    expect(rule(result, "value_tolerance_10pct").passed).toBe(false);
  });

  it("fails closed when the expected price is not positive", () => {
    const result = evaluateGate(perfectInput({ expectedValueCents: 0 }));
    expect(rule(result, "value_tolerance_10pct").passed).toBe(false);
  });

  // ---- rule 6: media --------------------------------------------------------

  it("accepts a photo just under the limit and rejects one at or over it", () => {
    // The limit is 10 MiB = 10,485,760 bytes, matching the storage bucket's
    // file_size_limit. The rule is strictly "under", so the limit itself fails.
    const justUnder = GATE_DEFAULTS.maxMediaBytes - 1;
    const atLimit = GATE_DEFAULTS.maxMediaBytes;
    const overLimit = GATE_DEFAULTS.maxMediaBytes + 1;

    const ok = evaluateGate(
      perfectInput({ media: { present: true, bytes: justUnder, mime: "image/jpeg" } }),
    );
    const at = evaluateGate(
      perfectInput({ media: { present: true, bytes: atLimit, mime: "image/jpeg" } }),
    );
    const big = evaluateGate(
      perfectInput({ media: { present: true, bytes: overLimit, mime: "image/jpeg" } }),
    );

    expect(rule(ok, "media_valid").passed).toBe(true);
    expect(rule(at, "media_valid").passed).toBe(false);
    expect(rule(big, "media_valid").passed).toBe(false);
  });

  it("rejects an unsupported image type", () => {
    const result = evaluateGate(
      perfectInput({ media: { present: true, bytes: 1000, mime: "application/pdf" } }),
    );
    expect(rule(result, "media_valid").passed).toBe(false);
  });

  it("fails closed when no photo was attached", () => {
    const result = evaluateGate(
      perfectInput({ media: { present: false, bytes: null, mime: null } }),
    );
    expect(rule(result, "media_valid").passed).toBe(false);
  });

  // ---- the adversarial case -------------------------------------------------

  it("rejects a perfect model output when the geofence rule fails", () => {
    // The model is certain the price matches, and it is right. The human was
    // 900 m away. The bounty must still be rejected.
    const result = evaluateGate(
      perfectInput({
        model: perfectModel({ verdict: "match", confidence: 0.99 }),
        captureLat: offsetNorth(STORE_LAT, 900),
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.failedRuleIds).toContain("geo_250m");
    expect(rule(result, "model_verdict_match").passed).toBe(true);
    expect(rule(result, "model_confidence_min").passed).toBe(true);
  });

  it("rejects a submission with no model output at all", () => {
    const result = evaluateGate(perfectInput({ model: null }));
    expect(result.passed).toBe(false);
    expect(result.failedRuleIds).toEqual(
      expect.arrayContaining(["model_verdict_match", "model_confidence_min"]),
    );
  });

  it("rejects everything when nothing at all is known", () => {
    const result = evaluateGate({
      expectedValueCents: 600,
      tolerancePct: 10,
      radiusMeters: 250,
      storeLat: STORE_LAT,
      storeLng: STORE_LNG,
      now: NOW,
      model: null,
      capturedAt: null,
      captureLat: null,
      captureLng: null,
      captureAccuracyM: null,
      media: { present: false, bytes: null, mime: null },
    });
    expect(result.passed).toBe(false);
    expect(result.failedRuleIds).toHaveLength(6);
  });

  it("exposes the thresholds it used, so the UI can show them", () => {
    expect(GATE_DEFAULTS.minConfidence).toBe(0.75);
    expect(GATE_DEFAULTS.maxCaptureAgeMs).toBe(30 * 60_000);
    expect(GATE_DEFAULTS.maxMediaBytes).toBe(10 * 1024 * 1024);
  });
});
