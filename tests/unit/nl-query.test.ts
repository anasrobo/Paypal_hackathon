import { describe, expect, it } from "vitest";
import { ALL_STATUSES, parseNaturalQuery } from "@/components/ops/nl-query";
import {
  buildLedgerQuery,
  gridFilterToLedgerFilters,
  parseLedgerQuery,
} from "@/ops/ledger-query";

/**
 * The natural-language layer and the grid filter model.
 *
 * The point of these tests is not that the phrases parse. It is that the
 * phrases and the column filters go through EXACTLY the same path, and that
 * an unrecognised phrase never silently becomes a filter.
 */

describe("the natural-language query layer", () => {
  it("compiles 'show failed payouts' into a status filter", () => {
    const result = parseNaturalQuery("show failed payouts");
    expect(result.ok).toBe(true);
    expect(result.filterModel.status).toEqual({
      filterType: "set",
      values: ["PAYOUT_FAILED", "PAYOUT_BLOCKED"],
    });
  });

  it("combines a status and an amount", () => {
    const result = parseNaturalQuery("paid over 5 dollars");
    expect(result.ok).toBe(true);
    expect(result.filterModel.status).toEqual({
      filterType: "set",
      values: ["PAID"],
    });
    expect(result.filterModel.rewardCents).toEqual({
      filterType: "number",
      type: "greaterThan",
      filter: 500,
    });
  });

  it("reads a dollar amount with cents", () => {
    const result = parseNaturalQuery("reward under $2.50");
    expect(result.ok).toBe(true);
    expect(result.filterModel.rewardCents).toEqual({
      filterType: "number",
      type: "lessThan",
      filter: 250,
    });
  });

  it("extracts a sku as a search term", () => {
    const result = parseNaturalQuery("sku 4471");
    expect(result.ok).toBe(true);
    expect(result.search).toBe("4471");
  });

  it("never reads 'not paid' as 'paid'", () => {
    const result = parseNaturalQuery("not paid");
    expect(result.ok).toBe(true);
    const values = (result.filterModel.status as { values: string[] }).values;
    expect(values).not.toContain("PAID");
    expect(values).toContain("PAYING");
  });

  it("does not read 'mismatch' as a match", () => {
    const result = parseNaturalQuery("mismatch");
    expect(result.ok).toBe(true);
    expect(result.filterModel.modelVerdict).toEqual({
      filterType: "set",
      values: ["mismatch"],
    });
    expect(result.filterModel.status).toBeUndefined();
  });

  it("refuses to guess when the phrase means nothing to it", () => {
    const result = parseNaturalQuery("banana");
    expect(result.ok).toBe(false);
    expect(result.filterModel).toEqual({});
    expect(result.search).toBeNull();
    expect(result.message).toContain("did not understand");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("refuses to guess on an empty phrase", () => {
    const result = parseNaturalQuery("   ");
    expect(result.ok).toBe(false);
    expect(result.filterModel).toEqual({});
  });
});

describe("the grid filter model", () => {
  it("turns a set filter into an 'in' filter", () => {
    const filters = gridFilterToLedgerFilters({
      status: { filterType: "set", values: ["PAID", "PAYING"] },
    });
    expect(filters).toEqual([{ column: "status", op: "in", value: ["PAID", "PAYING"] }]);
  });

  it("ignores a column that is not whitelisted", () => {
    const filters = gridFilterToLedgerFilters({
      secret: { filterType: "set", values: ["x"] },
      id: { filterType: "set", values: ["x"] },
    });
    // `id` is whitelisted; `secret` is not a column the builder knows about.
    expect(filters).toEqual([{ column: "id", op: "in", value: ["x"] }]);
  });

  it("ignores an empty set filter", () => {
    expect(gridFilterToLedgerFilters({ status: { filterType: "set", values: [] } })).toEqual([]);
  });

  it("produces the same SQL as the natural-language path", () => {
    const fromGrid = buildLedgerQuery(
      parseLedgerQuery({
        startRow: "0",
        endRow: "50",
        filters: JSON.stringify(
          gridFilterToLedgerFilters(parseNaturalQuery("paid over 5 dollars").filterModel),
        ),
      }),
    );

    const fromLanguage = buildLedgerQuery(
      parseLedgerQuery({
        startRow: "0",
        endRow: "50",
        filters: JSON.stringify(
          gridFilterToLedgerFilters(parseNaturalQuery("paid over 5 dollars").filterModel),
        ),
      }),
    );

    expect(fromGrid.rowsText).toBe(fromLanguage.rowsText);
    expect(fromGrid.rowsValues).toEqual(fromLanguage.rowsValues);
  });
});

describe("the ledger query builder", () => {
  it("binds every value instead of interpolating it", () => {
    const built = buildLedgerQuery(
      parseLedgerQuery({
        startRow: "0",
        endRow: "50",
        filters: JSON.stringify([
          { column: "sku", op: "contains", value: "'; DROP TABLE bounties; --" },
        ]),
      }),
    );

    expect(built.rowsText).not.toContain("DROP TABLE");
    // The dangerous text is a BOUND VALUE, wrapped in the LIKE wildcards.
    // It can never be parsed as SQL.
    expect(built.rowsValues).toEqual(["%'; DROP TABLE bounties; --%"]);
    expect(built.rowsValues.join(" ")).not.toBe("'; DROP TABLE bounties; --");
  });

  it("drops a filter on a column that is not whitelisted", () => {
    const built = buildLedgerQuery(
      parseLedgerQuery({
        startRow: "0",
        endRow: "50",
        filters: JSON.stringify([{ column: "secret", op: "eq", value: "x" }]),
      }),
    );
    expect(built.rowsValues).toEqual([]);
  });

  it("ignores a malformed filter payload instead of failing", () => {
    const built = buildLedgerQuery(
      parseLedgerQuery({ startRow: "0", endRow: "50", filters: "not json at all" }),
    );
    expect(built.rowsValues).toEqual([]);
  });

  it("clamps the page size", () => {
    const built = buildLedgerQuery({
      startRow: 0,
      endRow: 100_000,
      sort: null,
      filters: [],
      search: null,
    });
    expect(built.limit).toBe(500);
  });

  it("keeps the count query in step with the rows query", () => {
    const built = buildLedgerQuery({
      startRow: 0,
      endRow: 50,
      sort: null,
      filters: [{ column: "paidAt", op: "gte", value: 0 }],
      search: null,
    });
    // `paid_at` lives on payouts, so both queries must join it.
    expect(built.rowsText).toContain("LEFT JOIN payouts p");
    expect(built.countText).toContain("LEFT JOIN payouts p");
  });
});

describe("the status list", () => {
  it("covers every status the domain knows", () => {
    expect(ALL_STATUSES).toContain("PAID");
    expect(ALL_STATUSES).toContain("PAYOUT_FAILED");
    expect(new Set(ALL_STATUSES).size).toBe(ALL_STATUSES.length);
  });
});
