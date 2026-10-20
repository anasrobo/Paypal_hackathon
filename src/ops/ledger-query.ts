/**
 * The ops ledger query.
 *
 * ONE pure SQL builder, shared by the ops grid, the requester console and
 * the KPI aggregate. One implementation means the console and the grid can
 * never disagree about what a filter means.
 *
 * It is PURE: no database, no environment. It takes a query and returns the
 * SQL text and the values. That is what makes it unit-testable, and it is
 * what keeps a user-supplied string from ever reaching the database as
 * anything other than a bound value.
 *
 * The column list is a WHITELIST. A sort or filter on anything not in it is
 * rejected, which is both an injection guard and a guarantee that every
 * sortable column has an index behind it.
 */

export const LEDGER_COLUMNS = [
  "id",
  "sku",
  "storeName",
  "status",
  "modelVerdict",
  "modelConfidence",
  "expectedValueCents",
  "modelObservedCents",
  "rewardCents",
  "claimedByEmail",
  "requesterEmail",
  "createdAt",
  "paidAt",
] as const;

export type LedgerColumn = (typeof LEDGER_COLUMNS)[number];

const COLUMN_TO_SQL: Record<LedgerColumn, string> = {
  id: "b.id",
  sku: "b.sku",
  storeName: "b.store_name",
  status: "b.status",
  modelVerdict: "b.model_verdict",
  modelConfidence: "b.model_confidence",
  expectedValueCents: "b.expected_value_cents",
  modelObservedCents: "b.model_observed_cents",
  rewardCents: "b.reward_cents",
  claimedByEmail: "b.claimed_by_email",
  requesterEmail: "b.requester_email",
  createdAt: "b.created_at",
  paidAt: "b.paid_at",
};

export type FilterOp = "eq" | "contains" | "gte" | "lte" | "in";

export interface LedgerFilter {
  column: LedgerColumn;
  op: FilterOp;
  /** A string for contains, a number for the numeric comparisons, a list for `in`. */
  value: string | number | string[];
}

export interface LedgerQuery {
  startRow: number;
  endRow: number;
  sort: { column: LedgerColumn; direction: "asc" | "desc" } | null;
  filters: LedgerFilter[];
  /** A free-text search across the identifier fields. */
  search: string | null;
}

export const DEFAULT_LEDGER_QUERY: LedgerQuery = {
  startRow: 0,
  endRow: 50,
  sort: { column: "createdAt", direction: "desc" },
  filters: [],
  search: null,
};

export function isLedgerColumn(value: string): value is LedgerColumn {
  return (LEDGER_COLUMNS as readonly string[]).includes(value);
}

const NUMERIC_COLUMNS: ReadonlySet<LedgerColumn> = new Set([
  "modelConfidence",
  "expectedValueCents",
  "modelObservedCents",
  "rewardCents",
]);

function whereClause(
  query: LedgerQuery,
): { text: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];

  for (const filter of query.filters) {
    if (!isLedgerColumn(filter.column)) continue;
    const column = COLUMN_TO_SQL[filter.column];

    switch (filter.op) {
      case "eq": {
        values.push(filter.value);
        parts.push(`${column} = $${values.length}`);
        break;
      }
      case "contains": {
        values.push(`%${String(filter.value)}%`);
        parts.push(`${column} ILIKE $${values.length}`);
        break;
      }
      case "gte": {
        values.push(Number(filter.value));
        parts.push(`${column} >= $${values.length}`);
        break;
      }
      case "lte": {
        values.push(Number(filter.value));
        parts.push(`${column} <= $${values.length}`);
        break;
      }
      case "in": {
        const list = Array.isArray(filter.value) ? filter.value : [filter.value];
        if (list.length === 0) break;
        values.push(list);
        parts.push(`${column} = ANY($${values.length})`);
        break;
      }
      default:
        break;
    }
  }

  if (query.search && query.search.trim() !== "") {
    values.push(`%${query.search.trim()}%`);
    const index = values.length;
    parts.push(`(b.sku ILIKE $${index} OR b.id::text ILIKE $${index} OR b.store_name ILIKE $${index})`);
  }

  return { text: parts.length ? `WHERE ${parts.join(" AND ")}` : "", values };
}

export interface BuiltLedgerQuery {
  rowsText: string;
  rowsValues: unknown[];
  countText: string;
  countValues: unknown[];
  limit: number;
  offset: number;
}

export function buildLedgerQuery(query: LedgerQuery): BuiltLedgerQuery {
  const limit = Math.max(1, Math.min(500, query.endRow - query.startRow));
  const offset = Math.max(0, query.startRow);

  const where = whereClause(query);

  const sortColumn = query.sort && isLedgerColumn(query.sort.column)
    ? COLUMN_TO_SQL[query.sort.column]
    : COLUMN_TO_SQL.createdAt;
  const direction = query.sort?.direction === "asc" ? "ASC" : "DESC";

  // The tiebreaker on id keeps the page stable when two rows share a sort
  // value, which is what stops a row appearing on two pages at once.
  const rowsText = `
    SELECT
      b.id, b.sku, b.store_name, b.status, b.model_verdict, b.model_confidence,
      b.expected_value_cents, b.model_observed_cents, b.reward_cents,
      b.claimed_by_email, b.requester_email, b.created_at, b.paid_at,
      b.evidence_path, b.evidence_thumb_path, b.mock_scenario,
      p.status AS payout_status, p.sender_batch_id, p.paid_at AS payout_paid_at
    FROM bounties b
    LEFT JOIN payouts p ON p.bounty_id = b.id
    ${where.text}
    ORDER BY ${sortColumn} ${direction}, b.id ${direction}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countText = `
    SELECT COUNT(*)::int AS count
    FROM bounties b
    ${where.text}
  `;

  return {
    rowsText,
    rowsValues: where.values,
    countText,
    countValues: where.values,
    limit,
    offset,
  };
}

/**
 * Parse a query out of request parameters.
 *
 * Every value is validated against the whitelist before it becomes part of a
 * query. An unknown column is dropped, not passed through.
 */
export function parseLedgerQuery(
  input: Record<string, string | undefined>,
): LedgerQuery {
  const query: LedgerQuery = { ...DEFAULT_LEDGER_QUERY, filters: [] };

  const start = Number(input.startRow);
  const end = Number(input.endRow);
  if (Number.isFinite(start) && start >= 0) query.startRow = start;
  if (Number.isFinite(end) && end > query.startRow) query.endRow = end;

  const sortColumn = input.sort;
  if (sortColumn && isLedgerColumn(sortColumn)) {
    query.sort = {
      column: sortColumn,
      direction: input.direction === "asc" ? "asc" : "desc",
    };
  }

  const column = input.filterColumn;
  if (column && isLedgerColumn(column)) {
    const op = input.filterOp as FilterOp | undefined;
    const raw = input.filterValue;
    if (raw !== undefined && op) {
      const value = NUMERIC_COLUMNS.has(column) ? Number(raw) : raw;
      if (typeof value === "number" && !Number.isFinite(value)) {
        // An unparsable number is not a filter, it is a mistake.
      } else {
        query.filters.push({ column, op, value });
      }
    }
  }

  if (input.search && input.search.trim() !== "") {
    query.search = input.search;
  }

  return query;
}
