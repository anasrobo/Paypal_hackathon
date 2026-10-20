import { METERS_PER_DEGREE_LAT } from "@/domain/geo";
import type { GateInput, ModelOutput } from "@/domain/types";

/** The demo store. Every seeded bounty uses these coordinates. */
export const STORE_LAT = 12.9716;
export const STORE_LNG = 77.5946;

export const NOW = new Date("2026-10-20T10:00:00.000Z");

/** Move north by exactly `meters`, using the same sphere as the domain code. */
export function offsetNorth(lat: number, meters: number): number {
  return lat + meters / METERS_PER_DEGREE_LAT;
}

export function perfectModel(overrides: Partial<ModelOutput> = {}): ModelOutput {
  return {
    verdict: "match",
    confidence: 0.93,
    observedValueCents: 600,
    raw: { note: "price tag reads 6.00" },
    provider: "mock",
    model: "mock-vision-v1",
    latencyMs: 120,
    ...overrides,
  };
}

/** An input where every rule passes. Tests break one thing at a time. */
export function perfectInput(overrides: Partial<GateInput> = {}): GateInput {
  return {
    expectedValueCents: 600,
    tolerancePct: 10,
    radiusMeters: 250,
    storeLat: STORE_LAT,
    storeLng: STORE_LNG,
    now: NOW,
    model: perfectModel(),
    capturedAt: new Date(NOW.getTime() - 5 * 60_000),
    captureLat: offsetNorth(STORE_LAT, 40),
    captureLng: STORE_LNG,
    captureAccuracyM: 10,
    media: { present: true, bytes: 320_000, mime: "image/jpeg" },
    ...overrides,
  };
}
