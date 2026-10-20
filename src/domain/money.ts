/**
 * Money.
 *
 * Every amount in GroundTruth is an integer number of cents. There are no
 * floats anywhere near a payout amount.
 *
 * PURE: no I/O, no clock, no environment.
 */

/**
 * The deterministic PayPal idempotency key.
 *
 * Derived from the bounty id and nothing else — never random, never a
 * timestamp. A retry after a crash reuses the same key, so PayPal returns
 * the original batch instead of creating a second one. This is the last line
 * of defence against paying a stranger twice.
 */
export function senderBatchId(bountyId: string): string {
  return `gt-bounty-${bountyId}-v1`;
}

/**
 * Is `actualCents` within `tolerancePct` percent of `expectedCents`?
 *
 * Integer maths only:
 *   |actual - expected| * 100 <= expected * tolerancePct
 * A 10 % tolerance on $6.00 accepts $6.60 and rejects $6.66.
 *
 * Fails closed: a non-positive expected value can never be satisfied.
 */
export function withinTolerance(
  actualCents: number | null,
  expectedCents: number,
  tolerancePct: number,
): boolean {
  if (actualCents === null) return false;
  if (!Number.isInteger(actualCents) || !Number.isInteger(expectedCents)) return false;
  if (expectedCents <= 0) return false;
  if (tolerancePct < 0) return false;
  return Math.abs(actualCents - expectedCents) * 100 <= expectedCents * tolerancePct;
}

/** Format integer cents as a currency string. */
export function formatCents(cents: number, currency = "USD"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
  const grouped = major.toLocaleString("en-US");
  return `${sign}${symbol}${grouped}.${minor.toString().padStart(2, "0")}`;
}

/** Parse "$6.00" or "6" into cents. Returns null when it cannot be parsed. */
export function parseCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Is this a valid payout amount? Mirrors the database CHECK constraint. */
export function isValidPayoutAmount(cents: number): boolean {
  return Number.isInteger(cents) && cents > 0 && cents <= 100_000;
}
