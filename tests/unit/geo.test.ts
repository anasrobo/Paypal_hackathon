import { describe, expect, it } from "vitest";
import {
  METERS_PER_DEGREE_LAT,
  distanceMeters,
  distanceMetersOrNull,
  formatDistance,
  isValidCoordinate,
} from "@/domain/geo";
import { STORE_LAT, STORE_LNG, offsetNorth } from "./fixtures";

describe("geo", () => {
  it("measures zero distance to itself", () => {
    expect(distanceMeters(STORE_LAT, STORE_LNG, STORE_LAT, STORE_LNG)).toBe(0);
  });

  it("measures a degree of latitude as the sphere says it should", () => {
    const d = distanceMeters(0, 0, 1, 0);
    expect(d).toBeCloseTo(METERS_PER_DEGREE_LAT, 3);
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it("measures a known offset back to the tolerance we care about", () => {
    const d = distanceMeters(STORE_LAT, STORE_LNG, offsetNorth(STORE_LAT, 249), STORE_LNG);
    expect(d).toBeCloseTo(249, 0);
  });

  it("is symmetric", () => {
    const a = distanceMeters(STORE_LAT, STORE_LNG, offsetNorth(STORE_LAT, 120), STORE_LNG);
    const b = distanceMeters(offsetNorth(STORE_LAT, 120), STORE_LNG, STORE_LAT, STORE_LNG);
    expect(a).toBeCloseTo(b, 6);
  });

  it("rejects impossible coordinates", () => {
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(-91, 0)).toBe(false);
    expect(isValidCoordinate(0, 181)).toBe(false);
    expect(isValidCoordinate(Number.NaN, 0)).toBe(false);
    expect(isValidCoordinate(null, 0)).toBe(false);
    expect(isValidCoordinate(0, 0)).toBe(true);
  });

  it("returns null rather than a wrong number when a coordinate is missing", () => {
    expect(distanceMetersOrNull(null, { lat: 0, lng: 0 })).toBeNull();
    expect(distanceMetersOrNull({ lat: 0, lng: 0 }, null)).toBeNull();
    expect(distanceMetersOrNull({ lat: 999, lng: 0 }, { lat: 0, lng: 0 })).toBeNull();
  });

  it("formats a distance for the capture screen", () => {
    expect(formatDistance(42)).toBe("42 m");
    expect(formatDistance(1500)).toBe("1.50 km");
    expect(formatDistance(null)).toBe("unknown");
  });
});
