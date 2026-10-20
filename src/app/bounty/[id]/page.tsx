/**
 * The evidence record — screen 3 of 4.
 *
 * One bounty, everything known about it: the photo, what the model said, all
 * six rules with their actual and expected values, the payout, and the
 * append-only audit trail.
 *
 * This screen also TRIGGERS THE RECONCILER. A judge looking at a stuck
 * payout is the trigger — a free, always-on, zero-configuration timer that
 * beats a daily cron.
 */

import { notFound } from "next/navigation";
import { RuleChecklist, type ChecklistItem } from "@/components/bounty/RuleChecklist";
import { StatusPoller } from "@/components/bounty/StatusPoller";
import { Badge, Money, Panel, PanelHeader, StatusPill } from "@/components/ui/primitives";
import { GATE_RULE_LABELS } from "@/domain/gate";
import { RULE_IDS } from "@/domain/types";
import { db } from "@/server/db/client";
import {
  getBountyById,
  getEvidenceByBountyId,
  getPayoutByBountyId,
  getVerificationChecks,
  listAuditEvents,
} from "@/server/db/queries";
import { reconcileStuckPayouts } from "@/server/services/reconcile";
import { supabaseStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  created: "Bounty posted",
  claimed: "Accepted by a human",
  submitted: "Evidence submitted",
  verified: "All six rules passed",
  rejected: "A rule failed",
  payout_started: "Payout started",
  payout_submitted: "Sent to PayPal",
  payout_paid: "Money delivered",
  payout_failed: "Payout failed",
  payout_blocked: "Payout blocked",
  payout_refused: "Payout refused",
  payout_duplicate_blocked: "A second payout was blocked",
  payout_error: "Payout error",
  claim_link_reissued: "Claim link regenerated",
};

/** The statuses in which the outcome is still moving. */
const IN_FLIGHT = new Set(["SUBMITTED", "VERIFYING", "PAYING"]);

export default async function BountyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sql = db();

  const bounty = await getBountyById(sql, id);
  if (!bounty) notFound();

  // A judge looking at a stuck payout IS the trigger for the reconciler.
  await reconcileStuckPayouts();

  const [checkRows, payout, events, evidence] = await Promise.all([
    getVerificationChecks(sql, id),
    getPayoutByBountyId(sql, id),
    listAuditEvents(sql, id),
    getEvidenceByBountyId(sql, id),
  ]);

  // The evidence photo lives in a private bucket, so it is served through a
  // short-lived signed URL. If Storage is not configured the page still
  // renders — the rules and the payout are the important part.
  let photoUrl: string | null = null;
  if (bounty.evidencePath) {
    try {
      photoUrl = await supabaseStorage.signedUrl(bounty.evidencePath, 300);
    } catch {
      photoUrl = null;
    }
  }

  const evaluated = checkRows.length > 0;
  const items: ChecklistItem[] = evaluated
    ? checkRows.map((row) => {
        const observed = (row.observed ?? {}) as { actual?: string; detail?: string };
        const expected = (row.expected ?? {}) as { expected?: string; label?: string };
        return {
          id: row.ruleKey,
          label: expected.label ?? GATE_RULE_LABELS[row.ruleKey as keyof typeof GATE_RULE_LABELS] ?? row.ruleKey,
          passed: row.passed,
          expected: expected.expected ?? "—",
          actual: observed.actual ?? "—",
          detail: observed.detail ?? "",
        };
      })
    : RULE_IDS.map((ruleId) => ({
        id: ruleId,
        label: GATE_RULE_LABELS[ruleId],
        passed: null,
        expected: "—",
        actual: "not evaluated yet",
        detail: "",
      }));

  const paid = bounty.status === "PAID";
  const refused = ["REJECTED", "PAYOUT_FAILED", "PAYOUT_BLOCKED"].includes(bounty.status);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label">Evidence record</p>
          <h1 className="mt-1 flex flex-wrap items-baseline gap-2 text-xl font-medium tracking-tight">
            <span className="num">SKU {bounty.sku}</span>
            <span className="text-base text-muted">{bounty.storeName}</span>
          </h1>
          <p className="mt-1 text-xs text-faint">{bounty.storeAddress}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill status={bounty.status} />
          <StatusPoller watching={IN_FLIGHT.has(bounty.status)} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Evidence" hint="Uploaded straight to private storage, served by a signed URL." />
            <div className="p-4">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="The price tag submitted as evidence"
                  className="max-h-96 w-full rounded border border-line bg-ink object-contain"
                />
              ) : bounty.evidencePath ? (
                <p className="text-xs text-faint">
                  The photo exists in storage but could not be signed for display right now.
                </p>
              ) : (
                <p className="text-xs text-faint">No photo has been submitted yet.</p>
              )}

              {evidence ? (
                <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-faint sm:grid-cols-4">
                  <div>
                    <dt className="label">Captured</dt>
                    <dd className="mt-0.5 text-muted">
                      {evidence.capturedAt.toISOString().slice(0, 16).replace("T", " ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Location</dt>
                    <dd className="mt-0.5 text-muted">
                      {evidence.lat === null || evidence.lon === null
                        ? "—"
                        : `${evidence.lat.toFixed(4)}, ${evidence.lon.toFixed(4)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Accuracy</dt>
                    <dd className="mt-0.5 text-muted">
                      {evidence.accuracyM === null ? "—" : `±${evidence.accuracyM} m`}
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Size</dt>
                    <dd className="mt-0.5 text-muted">
                      {evidence.mime} · {(evidence.bytes / 1024).toFixed(0)} KB
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="The model"
              hint="Advisory only. It feeds two of the six rules and can never cause a payout on its own."
            />
            <div className="p-4">
              {bounty.modelVerdict === null ? (
                <p className="text-xs text-faint">The model has not been asked yet.</p>
              ) : (
                <dl className="num grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-4">
                  <div>
                    <dt className="label">Verdict</dt>
                    <dd
                      className={`mt-0.5 ${
                        bounty.modelVerdict === "match" ? "text-money" : "text-danger"
                      }`}
                    >
                      {bounty.modelVerdict}
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Confidence</dt>
                    <dd className="mt-0.5 text-muted">{bounty.modelConfidence ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="label">Read</dt>
                    <dd className="mt-0.5 text-muted">
                      <Money cents={bounty.modelObservedCents} currency={bounty.currency} />
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Latency</dt>
                    <dd className="mt-0.5 text-muted">
                      {bounty.modelLatencyMs === null ? "—" : `${bounty.modelLatencyMs} ms`}
                    </dd>
                  </div>
                </dl>
              )}
              {bounty.modelProvider ? (
                <p className="num mt-3 text-[11px] text-faint">provider · {bounty.modelProvider}</p>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Timeline" hint="Append-only. Every state change is recorded." />
            {events.length === 0 ? (
              <p className="px-4 py-4 text-xs text-faint">Nothing has happened yet.</p>
            ) : (
              <ol className="divide-y divide-line/60">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-baseline gap-3 px-4 py-2 last:border-0"
                  >
                    <span className="num w-16 shrink-0 text-[11px] text-faint">
                      {event.createdAt.toISOString().slice(11, 19)}
                    </span>
                    <span className="text-xs text-muted">
                      {EVENT_LABELS[event.type] ?? event.type}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel className="overflow-hidden">
            <RuleChecklist items={items} evaluated={evaluated} />
          </Panel>

          <Panel>
            <PanelHeader title="Payout" hint="The amount comes from the bounty row, never from a request." />
            <div className="p-4">
              {payout ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted">Amount</span>
                    <Money
                      cents={payout.amountCents}
                      currency={payout.currency}
                      tone={payout.status === "PAID" ? "money" : "default"}
                      className="text-lg"
                    />
                  </div>
                  <dl className="num mt-2 space-y-1 text-[11px] text-faint">
                    <div className="flex justify-between gap-3">
                      <dt>status</dt>
                      <dd
                        className={
                          payout.status === "PAID"
                            ? "text-money"
                            : payout.status === "SUBMITTED" || payout.status === "CREATED"
                              ? "text-warn"
                              : "text-danger"
                        }
                      >
                        {payout.status}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>payee</dt>
                      <dd className="truncate text-muted">{payout.payeeEmail}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>batch</dt>
                      <dd className="truncate text-muted">{payout.senderBatchId}</dd>
                    </div>
                    {payout.externalId ? (
                      <div className="flex justify-between gap-3">
                        <dt>paypal id</dt>
                        <dd className="truncate text-muted">{payout.externalId}</dd>
                      </div>
                    ) : null}
                    {payout.errorMessage ? (
                      <div className="flex justify-between gap-3">
                        <dt>error</dt>
                        <dd className="truncate text-danger">{payout.errorMessage}</dd>
                      </div>
                    ) : null}
                  </dl>
                </>
              ) : (
                <p className="text-xs text-faint">
                  {refused
                    ? "No payout was created, because the evidence did not pass every rule."
                    : "No payout has been created yet."}
                </p>
              )}

              {paid ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-money">
                  <Badge tone="money">PAID</Badge>
                  The money reached the person who proved it.
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
