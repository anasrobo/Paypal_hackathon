import { describe, expect, it } from "vitest";
import {
  TERMINAL_STATUSES,
  TRANSITIONS,
  assertTransition,
  automaticTargets,
  canTransition,
  isTerminal,
  nextStatuses,
} from "@/domain/state-machine";
import { AppError } from "@/domain/errors";
import { BOUNTY_STATUSES, type BountyStatus } from "@/domain/types";

describe("bounty state machine", () => {
  it("defines a transition set for every status", () => {
    for (const status of BOUNTY_STATUSES) {
      expect(Array.isArray(TRANSITIONS[status])).toBe(true);
    }
  });

  it("allows the happy path end to end", () => {
    expect(canTransition("POSTED", "CLAIMED")).toBe(true);
    expect(canTransition("CLAIMED", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "VERIFYING")).toBe(true);
    expect(canTransition("VERIFYING", "VERIFIED")).toBe(true);
    expect(canTransition("VERIFIED", "PAYING")).toBe(true);
    expect(canTransition("PAYING", "PAID")).toBe(true);
  });

  it("allows the rejection path", () => {
    expect(canTransition("VERIFYING", "REJECTED")).toBe(true);
  });

  it("allows the failure paths from PAYING", () => {
    expect(canTransition("PAYING", "PAYOUT_FAILED")).toBe(true);
    expect(canTransition("PAYING", "PAYOUT_BLOCKED")).toBe(true);
  });

  it("allows expiry and cancellation before submission", () => {
    expect(canTransition("POSTED", "EXPIRED")).toBe(true);
    expect(canTransition("CLAIMED", "CANCELLED")).toBe(true);
  });

  // ---- the money-safety edges ------------------------------------------------

  it("never allows PAYING to be entered from anything but VERIFIED automatically", () => {
    for (const from of BOUNTY_STATUSES) {
      if (from === "VERIFIED") continue;
      expect(canTransition(from, "PAYING")).toBe(false);
    }
  });

  it("never allows PAYING to be entered from REJECTED, even by an operator", () => {
    expect(canTransition("REJECTED", "PAYING", "operator-retry")).toBe(false);
    expect(() => assertTransition("REJECTED", "PAYING", "operator-retry")).toThrow(AppError);
  });

  it("treats a failed-payout re-drive as an operator action, not an automatic one", () => {
    expect(canTransition("PAYOUT_FAILED", "PAYING")).toBe(false);
    expect(canTransition("PAYOUT_FAILED", "PAYING", "operator-retry")).toBe(true);
    expect(canTransition("PAYOUT_BLOCKED", "PAYING")).toBe(false);
    expect(canTransition("PAYOUT_BLOCKED", "PAYING", "operator-retry")).toBe(true);
  });

  it("never leaves a terminal status", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(nextStatuses(status)).toHaveLength(0);
      for (const to of BOUNTY_STATUSES) {
        expect(canTransition(status, to, "operator-retry")).toBe(false);
      }
    }
  });

  it("never moves backwards out of PAYING", () => {
    expect(canTransition("PAYING", "VERIFIED")).toBe(false);
    expect(canTransition("PAYING", "SUBMITTED")).toBe(false);
    expect(canTransition("PAID", "PAYING", "operator-retry")).toBe(false);
  });

  it("throws rather than returning false, so a caller cannot forget to check", () => {
    expect(() => assertTransition("REJECTED", "PAYING")).toThrow(AppError);
    expect(() => assertTransition("POSTED", "PAID")).toThrow(/cannot become/i);
    expect(() => assertTransition("PAID", "PAYING")).toThrow(/final/i);
  });

  it("carries a machine-readable error code", () => {
    try {
      assertTransition("REJECTED", "PAYING");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(AppError.is(error)).toBe(true);
      expect((error as AppError).code).toBe("ILLEGAL_TRANSITION");
      expect((error as AppError).status).toBe(409);
    }
  });

  it("lists only the automatic targets for the pipeline", () => {
    expect(automaticTargets("VERIFIED")).toEqual(["PAYING"]);
    expect(automaticTargets("PAYOUT_FAILED")).toEqual([]);
    expect(automaticTargets("POSTED")).toEqual(["CLAIMED", "EXPIRED", "CANCELLED"]);
  });

  it("marks the right statuses as terminal", () => {
    const terminal = BOUNTY_STATUSES.filter(isTerminal);
    expect(terminal).toEqual<readonly BountyStatus[]>([
      "REJECTED",
      "PAID",
      "EXPIRED",
      "CANCELLED",
    ]);
  });
});
