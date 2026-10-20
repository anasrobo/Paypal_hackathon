"use client";

/**
 * The six-rule checklist.
 *
 * This is the screen's reason to exist. A judge should be able to see, in one
 * glance, that the money moved because six specific conditions held — not
 * because a model said so.
 *
 * The list is ALWAYS six rows long. A checklist that only shows the failures
 * hides how much work the passing rules did.
 */

import { RuleRow } from "@/components/ui/primitives";

export interface ChecklistItem {
  id: string;
  label: string;
  /** null means the rule has not been evaluated yet. */
  passed: boolean | null;
  expected: string;
  actual: string;
  detail: string;
}

export function RuleChecklist({
  items,
  evaluated,
}: {
  items: ChecklistItem[];
  evaluated: boolean;
}) {
  const passed = items.filter((item) => item.passed === true).length;
  const failed = items.filter((item) => item.passed === false).length;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="label">The six rules</p>
        <p className="num text-[11px] text-faint">
          {evaluated ? `${passed} passed · ${failed} failed` : "not evaluated yet"}
        </p>
      </div>
      <div className="divide-y divide-line/60">
        {items.map((item) => (
          <RuleRow
            key={item.id}
            passed={item.passed}
            label={item.label}
            expected={item.expected}
            actual={item.actual}
            detail={item.detail}
          />
        ))}
      </div>
    </div>
  );
}
