/**
 * The requester console — screen 1 of 4.
 *
 * An AI agent (or a person) posts a bounty here, gets a claim link, and hands
 * that link to a human who is near the store. The list below is the live
 * state of every bounty in the system.
 *
 * It is a Server Component: the data is already in the database when the page
 * renders, so the list is never empty on first paint and never shows a
 * spinner. The only interactive parts — posting a bounty and copying a claim
 * link — are Client Components that call Server Actions.
 */

import { CreateBountyForm } from "@/components/console/CreateBountyForm";
import { BountyList, type BountySummary } from "@/components/console/BountyList";
import { Money, Panel, Stat } from "@/components/ui/primitives";
import { db } from "@/server/db/client";
import { getBountyKpis, listBounties } from "@/server/db/queries";

export const dynamic = "force-dynamic";

const STEPS: { label: string; detail: string }[] = [
  { label: "01 · Post", detail: "An agent posts a bounty with a SKU, a store and a price to prove." },
  { label: "02 · Accept", detail: "A human nearby accepts the link and earns the reward." },
  { label: "03 · Prove", detail: "A photo plus GPS. A model reads the tag — as advice, never as a verdict." },
  { label: "04 · Pay", detail: "Six deterministic rules decide. PayPal Payouts sends the money." },
];

export default async function ConsolePage() {
  // Two queries, in parallel. The list and the KPIs never disagree because
  // they are read from the same database in the same tick.
  const [bounties, kpis] = await Promise.all([listBounties(db(), 50), getBountyKpis(db())]);

  const summaries: BountySummary[] = bounties.map((b) => ({
    id: b.id,
    sku: b.sku,
    storeName: b.storeName,
    storeAddress: b.storeAddress,
    status: b.status,
    rewardCents: b.rewardCents,
    currency: b.currency,
    expectedValueCents: b.expectedValueCents,
    createdAt: b.createdAt.toISOString(),
    claimedByEmail: b.claimedByEmail,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="label">Physical-world verification for AI agents</p>
        <h1 className="max-w-3xl text-2xl font-medium leading-tight tracking-tight text-text sm:text-[28px]">
          Agents need facts that only exist in the physical world.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Post a bounty. A human nearby photographs the shelf. A deterministic rule set — not the
          model — decides whether the evidence is good. PayPal Payouts sends the money to that
          person&apos;s email.
        </p>
      </header>

      <Panel>
        <div className="grid grid-cols-2 divide-line sm:grid-cols-5 sm:divide-x">
          <Stat label="Bounties" value={kpis.total} />
          <Stat label="Open" value={kpis.posted} hint="waiting for a human" />
          <Stat label="In flight" value={kpis.inFlight} tone="warn" hint="claimed or verifying" />
          <Stat label="Paid" value={kpis.paid} tone="money" hint="money delivered" />
          <Stat
            label="Paid out"
            value={<Money cents={kpis.paidCents} tone="money" />}
            hint={`${kpis.failed} refused`}
          />
        </div>
      </Panel>

      <Panel>
        <ol className="grid gap-px bg-line sm:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.label} className="bg-raised px-4 py-3">
              <p className="label">{step.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{step.detail}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <CreateBountyForm />
        <BountyList bounties={summaries} />
      </div>
    </div>
  );
}
