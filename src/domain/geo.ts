/**
 * Geodesy.
 *
 * PURE: no I/O, no clock, no environment.
 *
 * The haversine formula on a spherical earth. Accurate to roughly 0.5 %,
 * which is far inside the 250 m rule we care about.
 */

const EARTH_RADIUS_M = 6_371_008.8;

/** Metres per degree of latitude. Exported so tests can build exact offsets. */
export const METERS_PER_DEGREE_LAT = (Math.PI * EARTH_RADIUS_M) / 180;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export interface LatLng {
  lat: number;
  lng: number;
}

export function isValidCoordinate(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/** Great-circle distance between two points, in metres. */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance between two optional coordinates, or null when either is missing. */
export function distanceMetersOrNull(
  a: LatLng | null,
  b: LatLng | null,
): number | null {
  if (!a || !b) return null;
  if (!isValidCoordinate(a.lat, a.lng) || !isValidCoordinate(b.lat, b.lng)) return null;
  return distanceMeters(a.lat, a.lng, b.lat, b.lng);
}

/** Human-readable distance for the capture screen's live preview. */
export function formatDistance(meters: number | null): string {
  if (meters === null) return "unknown";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
