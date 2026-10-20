import { describe, expect, it } from "vitest";
import {
  formatCents,
  isValidPayoutAmount,
  parseCents,
  senderBatchId,
  withinTolerance,
} from "@/domain/money";

describe("money", () => {
  describe("senderBatchId", () => {
    it("is deterministic and contains no randomness or time", () => {
      const a = senderBatchId("bounty-123");
      const b = senderBatchId("bounty-123");
      expect(a).toBe(b);
      expect(a).toBe("gt-bounty-bounty-123-v1");
      expect(a).not.toMatch(/\d{10,}/); // no timestamp
      expect(a).not.toMatch(/[0-9a-f]{8}-/); // no uuid
    });

    it("differs for different bounties", () => {
      expect(senderBatchId("a")).not.toBe(senderBatchId("b"));
    });

    it("stays stable across a thousand calls", () => {
      const first = senderBatchId("stable");
      for (let i = 0; i < 1000; i += 1) {
        expect(senderBatchId("stable")).toBe(first);
      }
    });
  });

  describe("withinTolerance", () => {
    it("accepts a value exactly on the tolerance boundary", () => {
      // $6.00 expected, 10 % tolerance => $6.60 is exactly on the line.
      expect(withinTolerance(660, 600, 10)).toBe(true);
    });

    it("rejects a value just past the tolerance boundary", () => {
      expect(withinTolerance(666, 600, 10)).toBe(false);
    });

    it("uses integer maths, with no floating point drift", () => {
      // 0.1 + 0.2 style drift would break a float comparison here.
      expect(withinTolerance(1000, 1000, 10)).toBe(true);
      expect(withinTolerance(1100, 1000, 10)).toBe(true);
      expect(withinTolerance(1101, 1000, 10)).toBe(false);
    });

    it("fails closed on a missing observed value", () => {
      expect(withinTolerance(null, 600, 10)).toBe(false);
    });

    it("fails closed when the expected value is not positive", () => {
      expect(withinTolerance(600, 0, 10)).toBe(false);
      expect(withinTolerance(600, -100, 10)).toBe(false);
    });

    it("fails closed on a non-integer amount", () => {
      expect(withinTolerance(600.5, 600, 10)).toBe(false);
      expect(withinTolerance(600, 600.5, 10)).toBe(false);
    });

    it("fails closed on a negative tolerance", () => {
      expect(withinTolerance(600, 600, -1)).toBe(false);
    });
  });

  describe("formatCents", () => {
    it("formats whole dollars with two decimals", () => {
      expect(formatCents(600)).toBe("$6.00");
      expect(formatCents(0)).toBe("$0.00");
      expect(formatCents(5)).toBe("$0.05");
    });

    it("groups thousands", () => {
      expect(formatCents(123_456)).toBe("$1,234.56");
    });

    it("handles a negative amount", () => {
      expect(formatCents(-600)).toBe("-$6.00");
    });

    it("uses the right symbol", () => {
      expect(formatCents(600, "EUR")).toBe("€6.00");
      expect(formatCents(600, "GBP")).toBe("£6.00");
    });
  });

  describe("parseCents", () => {
    it("parses a plain decimal string", () => {
      expect(parseCents("6.00")).toBe(600);
      expect(parseCents("6")).toBe(600);
      expect(parseCents("$6.50")).toBe(650);
    });

    it("returns null for anything it cannot parse", () => {
      expect(parseCents("")).toBeNull();
      expect(parseCents("abc")).toBeNull();
      expect(parseCents("-")).toBeNull();
    });
  });

  describe("isValidPayoutAmount", () => {
    it("accepts a sane bounty reward", () => {
      expect(isValidPayoutAmount(600)).toBe(true);
      expect(isValidPayoutAmount(100_000)).toBe(true);
    });

    it("rejects zero, negative, fractional and absurd amounts", () => {
      expect(isValidPayoutAmount(0)).toBe(false);
      expect(isValidPayoutAmount(-600)).toBe(false);
      expect(isValidPayoutAmount(600.5)).toBe(false);
      expect(isValidPayoutAmount(100_001)).toBe(false);
    });
  });
});
