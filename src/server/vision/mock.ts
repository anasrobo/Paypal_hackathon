/**
 * The deterministic mock vision provider.
 *
 * It exists so the whole product — the gate, the payout, the webhook, the
 * tests, the demo video — can be finished before a vision API key exists.
 *
 * It is DETERMINISTIC. The same scenario always produces the same output, so
 * the demo is repeatable and the tests are stable. A mock that decided
 * randomly would make the demo unrepeatable and the tests flaky.
 */

import type { ModelOutput } from "@/domain/types";
import { getEnv } from "../env";
import type { MockScenario, VisionProvider, VisionRequest } from "./provider";

/**
 * The out-of-tolerance price.
 *
 * 1.665 of the expected price. On $6.00 that is $9.99 — 66 % away, which is
 * unambiguously outside a 10 % tolerance, and a number a judge can read off
 * the screen and check by eye.
 */
const MISMATCH_FACTOR = 1.665;

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function build(scenario: MockScenario, expectedValueCents: number): Omit<ModelOutput, "latencyMs"> {
  switch (scenario) {
    case "mismatch":
      return {
        verdict: "mismatch",
        confidence: 0.41,
        observedValueCents: Math.round(expectedValueCents * MISMATCH_FACTOR),
        raw: {
          note: "A price tag was found but the value did not match the request.",
          provider: "mock",
        },
        provider: "mock",
        model: "mock-vision-v1",
      };

    case "low_confidence":
      return {
        verdict: "match",
        confidence: 0.42,
        observedValueCents: expectedValueCents,
        raw: {
          note: "The tag was partially obscured. The reading is not confident.",
          provider: "mock",
        },
        provider: "mock",
        model: "mock-vision-v1",
      };

    case "unreadable":
      return {
        verdict: "unreadable",
        confidence: 0.3,
        observedValueCents: null,
        raw: {
          note: "No price tag could be identified in the photo.",
          provider: "mock",
        },
        provider: "mock",
        model: "mock-vision-v1",
      };

    case "match":
    default:
      return {
        verdict: "match",
        confidence: 0.93,
        observedValueCents: expectedValueCents,
        raw: {
          note: "A price tag was found and the value matches the request.",
          provider: "mock",
        },
        provider: "mock",
        model: "mock-vision-v1",
      };
  }
}

export const mockVision: VisionProvider = {
  name: "mock",
  model: "mock-vision-v1",
  needsImage: false,

  async readPriceTag(request: VisionRequest): Promise<ModelOutput> {
    const { MOCK_VISION_LATENCY_MS } = getEnv();
    await delay(MOCK_VISION_LATENCY_MS);

    const scenario: MockScenario = request.scenario ?? "match";
    const output = build(scenario, request.expectedValueCents);

    return { ...output, latencyMs: MOCK_VISION_LATENCY_MS };
  },
};
