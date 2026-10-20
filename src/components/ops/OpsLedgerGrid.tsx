"use client";

/**
 * The ops ledger.
 *
 * AG Grid COMMUNITY, MIT licensed, with the INFINITE row model. The
 * Server-Side Row Model is an Enterprise feature and would be a licence
 * violation in a GPL-3.0 repository, so the infinite model is the correct
 * choice: it is server-paginated, it fetches a block at a time, and the whole
 * table never travels to the browser.
 *
 * The sponsor's criterion is "custom widgets, theming, and layout tools, not
 * just AG Grid on their own". So:
 *
 *   - a CUSTOM THEME built from the app's own tokens, through the Theming API
 *   - SIX CUSTOM CELL RENDERERS: state pill, verdict badge, amount, evidence
 *     thumbnail, identifier, and end-to-end latency
 *   - a HAND-BUILT NATURAL-LANGUAGE QUERY LAYER that compiles a phrase into
 *     the same filter model the grid uses
 *
 * The natural-language layer is deterministic, not a model. That is a feature:
 * an operator asking "show failed payouts" gets exactly the rows the column
 * filter would give, and an unrecognised phrase returns an error rather than
 * a guess.
 */

import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type FilterChangedEvent,
  type GridApi,
  type GridReadyEvent,
  type IDatasource,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gridFilterToLedgerFilters, type GridFilterModel, type LedgerFilter } from "@/ops/ledger-query";
import { Badge, Button, Input } from "@/components/ui/primitives";
import {
  EvidenceCell,
  LatencyCell,
  MoneyCell,
  MonoCell,
  StatusCell,
  VerdictCell,
} from "./cellRenderers";
import { parseNaturalQuery, type NlParseResult } from "./nl-query";

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * The grid theme, built from the application's own tokens.
 *
 * AG Grid v33 removed the legacy CSS themes, so this uses the Theming API
 * rather than a stylesheet. One accent colour, and it is the money colour.
 */
const gtTheme = themeQuartz.withParams({
  accentColor: "#3ddc97",
  backgroundColor: "#14171c",
  foregroundColor: "#e7eaf0",
  borderColor: "#232830",
  headerBackgroundColor: "#1b1f26",
  headerTextColor: "#8a93a3",
  headerFontSize: 11,
  fontSize: 12,
  fontFamily: "var(--font-geist-sans)",
  cellHorizontalPadding: 10,
  rowBorder: { color: "#232830" },
  oddRowBackgroundColor: "#161a20",
  rowHoverColor: "#1b1f26",
  wrapperBorderRadius: 0,
});

export interface LedgerRow {
  id: string;
  sku: string;
  storeName: string;
  status: string;
  modelVerdict: string | null;
  modelConfidence: number | null;
  expectedValueCents: number;
  modelObservedCents: number | null;
  rewardCents: number;
  claimedByEmail: string | null;
  requesterEmail: string | null;
  createdAt: string;
  paidAt: string | null;
  evidenceThumbUrl: string | null;
  mockScenario: string | null;
  payoutStatus: string | null;
  senderBatchId: string | null;
  payoutPaidAt: string | null;
}

export function OpsLedgerGrid() {
  const gridApi = useRef<GridApi<LedgerRow> | null>(null);
  const searchRef = useRef("");
  /**
   * The filters, in ONE place.
   *
   * The grid's own column filters and the natural-language layer both end up
   * here, and the datasource reads from here. That is what makes "show failed
   * payouts" and clicking a column filter mean exactly the same thing — there
   * is only one filter, and one path to the server.
   *
   * The two sources are kept apart on purpose. The grid's column filters are
   * the operator's; the natural-language filters are the question's. Both
   * apply, and the chip says which is which.
   */
  /** The combined list the datasource reads. Written synchronously. */
  const combinedRef = useRef<LedgerFilter[]>([]);
  /** The two sources, for the handlers that must not see a stale copy. */
  const nlFiltersRef = useRef<LedgerFilter[]>([]);
  const gridFiltersRef = useRef<LedgerFilter[]>([]);

  const [search, setSearch] = useState("");
  const [nlText, setNlText] = useState("");
  const [nlResult, setNlResult] = useState<NlParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<{ vision: string; paypal: string } | null>(null);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  const columnDefs = useMemo<ColDef<LedgerRow>[]>(
    () => [
      {
        field: "sku",
        headerName: "SKU",
        width: 108,
        cellRenderer: MonoCell,
        filter: "agTextColumnFilter",
      },
      {
        field: "storeName",
        headerName: "Store",
        minWidth: 150,
        flex: 1.5,
        cellRenderer: MonoCell,
        filter: "agTextColumnFilter",
      },
      {
        field: "status",
        headerName: "Status",
        width: 148,
        cellRenderer: StatusCell,
        // A TEXT filter, not a set filter. The AG Grid set filter is an
        // Enterprise feature, and this repository is GPL-3.0 — using it
        // would be a licence violation. `scripts/check-aggrid.mjs` fails the
        // build if it ever appears.
        filter: "agTextColumnFilter",
        filterParams: { filterOptions: ["equals", "notEqual", "contains"] },
      },
      {
        field: "modelVerdict",
        headerName: "Model",
        width: 124,
        cellRenderer: VerdictCell,
        filter: "agTextColumnFilter",
        filterParams: { filterOptions: ["equals", "notEqual", "contains"] },
      },
      {
        field: "modelConfidence",
        headerName: "Conf",
        width: 76,
        cellRenderer: MonoCell,
        filter: "agNumberColumnFilter",
      },
      {
        field: "expectedValueCents",
        headerName: "Expected",
        width: 104,
        cellRenderer: MoneyCell,
        filter: "agNumberColumnFilter",
      },
      {
        field: "modelObservedCents",
        headerName: "Read",
        width: 96,
        cellRenderer: MoneyCell,
        filter: "agNumberColumnFilter",
      },
      {
        field: "rewardCents",
        headerName: "Reward",
        width: 104,
        cellRenderer: MoneyCell,
        filter: "agNumberColumnFilter",
      },
      {
        field: "evidenceThumbUrl",
        headerName: "Evidence",
        width: 92,
        cellRenderer: EvidenceCell,
        sortable: false,
        filter: false,
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: 150,
        cellRenderer: MonoCell,
        filter: "agTextColumnFilter",
      },
      {
        field: "payoutPaidAt",
        headerName: "End to end",
        width: 116,
        cellRenderer: LatencyCell,
        sortable: false,
        filter: false,
      },
    ],
    [],
  );

  const datasource = useMemo<IDatasource>(
    () => ({
      getRows: async (params) => {
        const query = new URLSearchParams();
        query.set("startRow", String(params.startRow));
        query.set("endRow", String(params.endRow));

        const sort = params.sortModel?.[0];
        if (sort) {
          query.set("sort", sort.colId);
          query.set("direction", sort.sort === "asc" ? "asc" : "desc");
        }

        const filters = combinedRef.current;
        if (filters.length > 0) query.set("filters", JSON.stringify(filters));

        const term = searchRef.current.trim();
        if (term) query.set("search", term);

        try {
          const response = await fetch(`/api/ops/ledger?${query.toString()}`);
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body?.error?.message ?? "The ledger could not be loaded.");
          }
          setError(null);
          setTotal(Number(body.total ?? 0));
          if (body.meta) setMeta(body.meta);

          const rows: LedgerRow[] = Array.isArray(body.rows) ? body.rows : [];
          const requested = params.endRow - params.startRow;
          const isLastBlock = rows.length < requested;
          params.successCallback(rows, isLastBlock ? Math.max(0, Number(body.total ?? 0) - 1) : undefined);
        } catch (caught) {
          setError(
            caught instanceof Error ? caught.message : "The ledger could not be loaded.",
          );
          params.failCallback();
        }
      },
    }),
    [],
  );

  const onGridReady = useCallback(
    (event: GridReadyEvent<LedgerRow>) => {
      gridApi.current = event.api;
      event.api.setGridOption("datasource", datasource);
    },
    [datasource],
  );

  // A new search term means new rows, so the cached blocks are dropped.
  useEffect(() => {
    gridApi.current?.purgeInfiniteCache();
  }, [search]);

  /**
   * Apply a filter, from anywhere.
   *
   * The cache is purged explicitly. A filter whose component has never been
   * opened does not always fire the change event the infinite row model
   * listens for, so the refresh is made certain rather than hoped for.
   */
  const commit = useCallback((nextNl: LedgerFilter[], nextGrid: LedgerFilter[]) => {
    nlFiltersRef.current = nextNl;
    gridFiltersRef.current = nextGrid;
    combinedRef.current = [...nextNl, ...nextGrid];
    gridApi.current?.purgeInfiniteCache();
  }, []);

  /**
   * The operator used a column filter.
   *
   * The grid's own filters are written into the SAME list the natural
   * language layer writes into, so the two can never disagree about what the
   * server is being asked for.
   */
  const onFilterChanged = useCallback(
    (event: FilterChangedEvent) => {
      const model = (event.api.getFilterModel() ?? {}) as GridFilterModel;
      commit(nlFiltersRef.current, gridFilterToLedgerFilters(model));
    },
    [commit],
  );

  function runNaturalQuery() {
    const result = parseNaturalQuery(nlText);
    setNlResult(result);
    if (!result.ok) return;
    commit(gridFilterToLedgerFilters(result.filterModel), gridFiltersRef.current);
    setSearch(result.search ?? "");
  }

  function clearEverything() {
    setNlText("");
    setNlResult(null);
    setSearch("");
    commit([], []);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search SKU, store or id"
            aria-label="Search the ledger"
            className="w-full sm:max-w-xs"
          />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/*
              The input must be allowed to shrink BELOW its content width,
              and the button must never shrink at all. Without both, the
              input's placeholder keeps it wide enough to cover the button,
              and on a phone the button cannot be tapped.
            */}
            <Input
              value={nlText}
              onChange={(event) => setNlText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runNaturalQuery();
              }}
              placeholder="Ask the ledger: show failed payouts"
              aria-label="Ask the ledger in plain language"
              className="min-w-0 flex-1"
            />
            <Button className="shrink-0" onClick={runNaturalQuery}>
              Ask
            </Button>
          </div>
          <Button className="shrink-0" variant="ghost" onClick={clearEverything}>
            Clear
          </Button>
        </div>

        {nlResult?.ok && nlResult.chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label">parsed as</span>
            {nlResult.chips.map((chip) => (
              <Badge key={chip} tone="info">
                {chip}
              </Badge>
            ))}
          </div>
        ) : null}

        {nlResult && !nlResult.ok ? (
          <div className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2">
            <p className="text-xs text-warn">{nlResult.message}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {nlResult.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setNlText(suggestion);
                    const result = parseNaturalQuery(suggestion);
                    setNlResult(result);
                    if (!result.ok) return;
                    commit(gridFilterToLedgerFilters(result.filterModel), gridFiltersRef.current);
                    setSearch(result.search ?? "");
                  }}
                  className="rounded border border-warn/30 px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:border-money/40 hover:text-money"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>

      {/*
        The grid is wrapped in a div with a DEFINITE height.

        AG Grid sets `height: 100%` on its own root element, so the height has
        to come from a parent it can actually resolve against. Applied to the
        grid element itself, the percentage resolved against an auto-height
        parent and the whole table collapsed to two pixels — the rows were in
        the DOM and nowhere on the screen.
      */}
      <div className="h-[calc(100dvh-21rem)] min-h-[24rem] w-full">
        <AgGridReact<LedgerRow>
          theme={gtTheme}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          onFilterChanged={onFilterChanged}
          rowModelType="infinite"
          cacheBlockSize={50}
          maxBlocksInCache={8}
          rowHeight={42}
          headerHeight={34}
          suppressCellFocus
          animateRows={false}
          overlayNoRowsTemplate={
            '<span style="color:#8a93a3;font-size:12px;padding:24px;display:block">No rows match this query.</span>'
          }
          className="h-full w-full"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-faint">
        <span className="num">{total} rows in the ledger</span>
        {meta ? (
          <span className="num">
            vision: {meta.vision} · paypal: {meta.paypal} · sandbox only
          </span>
        ) : null}
      </div>
    </div>
  );
}
