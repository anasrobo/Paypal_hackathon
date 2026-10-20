/**
 * The natural-language query layer.
 *
 * A DETERMINISTIC parser, not a model. "Show failed payouts" compiles to
 * exactly the filter model the grid produces when you click a column filter,
 * so the two can never disagree about what a phrase means.
 *
 * The rule that matters: an unrecognised phrase NEVER produces a filter. It
 * produces a typed "I did not understand" and the list of phrases that do
 * work. A wrong answer is worse than no answer, because an operator would
 * act on it.
 *
 * This is the free-tier analogue of a natural-language grid assistant. It is
 * pure — no DOM, no network, no clock — so it is unit-tested as a function.
 */

import { formatCents, parseCents } from "@/domain/money";
import type { GridFilterModel } from "@/ops/ledger-query";

export interface NlParseResult {
  /** True when the phrase was understood. */
  ok: boolean;
  /** The AG Grid filter model the phrase compiled to. */
  filterModel: GridFilterModel;
  /** A free-text search term, if the phrase contained one. */
  search: string | null;
  /** The chips shown as "parsed as …". */
  chips: string[];
  /** The typed "I did not understand" message. */
  message: string | null;
  /** The phrases this parser understands. */
  suggestions: string[];
}

export const ALL_STATUSES = [
  "POSTED",
  "CLAIMED",
  "SUBMITTED",
  "VERIFYING",
  "VERIFIED",
  "REJECTED",
  "PAYING",
  "PAID",
  "PAYOUT_FAILED",
  "PAYOUT_BLOCKED",
  "EXPIRED",
  "CANCELLED",
];

export const NL_SUGGESTIONS = [
  "show failed payouts",
  "paid over 5 dollars",
  "sku 4471",
  "stuck paying",
  "rejected evidence",
  "unreadable photos",
  "not paid",
  "mismatch under 10 dollars",
];

interface StatusIntent {
  pattern: RegExp;
  statuses: string[];
  negate?: boolean;
  label: string;
}

/**
 * The status phrases.
 *
 * ORDER MATTERS. "not paid" is listed before "paid" so that a negation is
 * never swallowed by the positive match, and "failed" is listed before the
 * rest so "failed payouts" is not read as a generic non-paid query.
 */
const STATUS_INTENTS: StatusIntent[] = [
  {
    pattern: /\b(fail(?:ed|ure|ures)?|errored?)\b/,
    statuses: ["PAYOUT_FAILED", "PAYOUT_BLOCKED"],
    label: "status is failed",
  },
  {
    pattern: /\b(reject(?:ed|s)?|rejection)\b/,
    statuses: ["REJECTED"],
    label: "status is rejected",
  },
  {
    pattern: /\b(not paid|unpaid|never paid|unsettled)\b/,
    statuses: ["PAID"],
    negate: true,
    label: "status is not paid",
  },
  {
    pattern: /\b(paid|delivered|settled|successful|successful)\b/,
    statuses: ["PAID"],
    label: "status is paid",
  },
  {
    pattern: /\b(stuck|in flight|in-flight|paying)\b/,
    statuses: ["PAYING"],
    label: "status is paying",
  },
  {
    pattern: /\b(open|posted|waiting|unclaimed|available)\b/,
    statuses: ["POSTED", "CLAIMED"],
    label: "status is open",
  },
  {
    pattern: /\b(verified|approved)\b/,
    statuses: ["VERIFIED"],
    label: "status is verified",
  },
  {
    pattern: /\b(submitted)\b/,
    statuses: ["SUBMITTED"],
    label: "status is submitted",
  },
  {
    pattern: /\b(expired)\b/,
    statuses: ["EXPIRED"],
    label: "status is expired",
  },
];

const VERDICT_INTENTS: { pattern: RegExp; value: string; label: string }[] = [
  { pattern: /\bunreadable\b/, value: "unreadable", label: "model read unreadable" },
  { pattern: /\bmismatch(?:ed)?\b/, value: "mismatch", label: "model read a mismatch" },
  { pattern: /\bmatch(?:es|ed)?\b/, value: "match", label: "model read a match" },
];

const OVER = /\b(?:over|above|more than|greater than|at least|exceeding)\s*\$?\s*(\d+(?:\.\d{1,2})?)/;
const UNDER = /\b(?:under|below|less than|at most|cheaper than)\s*\$?\s*(\d+(?:\.\d{1,2})?)/;
const SKU = /\bsku[:\s]+([a-z0-9][a-z0-9._-]*)/;

const NOT_UNDERSTOOD =
  "I did not understand that. Try one of the phrases below — I will not guess, because a wrong filter is worse than no filter.";

/**
 * Compile a phrase into a grid filter model.
 *
 * Returns `ok: false` with a message when nothing in the phrase was
 * understood. It never returns a half-built filter.
 */
export function parseNaturalQuery(input: string): NlParseResult {
  const raw = input.trim();
  const text = raw.toLowerCase();

  if (text === "") {
    return {
      ok: false,
      filterModel: {},
      search: null,
      chips: [],
      message: NOT_UNDERSTOOD,
      suggestions: NL_SUGGESTIONS,
    };
  }

  const filterModel: GridFilterModel = {};
  const chips: string[] = [];
  let search: string | null = null;
  let matched = false;

  for (const intent of STATUS_INTENTS) {
    if (!intent.pattern.test(text)) continue;
    matched = true;
    if (intent.negate) {
      filterModel.status = {
        filterType: "set",
        values: ALL_STATUSES.filter((status) => !intent.statuses.includes(status)),
      };
      chips.push(`status is not ${intent.statuses.join(", ")}`);
    } else {
      filterModel.status = { filterType: "set", values: intent.statuses };
      chips.push(intent.label);
    }
    break;
  }

  for (const intent of VERDICT_INTENTS) {
    if (!intent.pattern.test(text)) continue;
    matched = true;
    filterModel.modelVerdict = { filterType: "set", values: [intent.value] };
    chips.push(intent.label);
    break;
  }

  const over = OVER.exec(text);
  if (over) {
    const cents = parseCents(over[1]);
    if (cents !== null) {
      matched = true;
      filterModel.rewardCents = { filterType: "number", type: "greaterThan", filter: cents };
      chips.push(`reward at least ${formatCents(cents)}`);
    }
  }

  const under = UNDER.exec(text);
  if (under) {
    const cents = parseCents(under[1]);
    if (cents !== null) {
      matched = true;
      filterModel.rewardCents = { filterType: "number", type: "lessThan", filter: cents };
      chips.push(`reward at most ${formatCents(cents)}`);
    }
  }

  const sku = SKU.exec(text);
  if (sku) {
    matched = true;
    search = sku[1];
    chips.push(`search "${sku[1]}"`);
  }

  if (!matched) {
    return {
      ok: false,
      filterModel: {},
      search: null,
      chips: [],
      message: `${NOT_UNDERSTOOD} I did not understand "${raw}".`,
      suggestions: NL_SUGGESTIONS,
    };
  }

  return { ok: true, filterModel, search, chips, message: null, suggestions: NL_SUGGESTIONS };
}
