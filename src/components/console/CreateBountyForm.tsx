"use client";

/**
 * The "post a bounty" form.
 *
 * It posts to a Server Action, so the browser never sees a database
 * connection and the amount that will eventually be paid is validated on the
 * server, not here. The client-side checks exist to make the form pleasant,
 * not to make it safe.
 *
 * The demo buttons are a deliberate affordance: a judge can fill in a real
 * store's coordinates in one tap, so the twenty-second demo does not depend
 * on remembering a latitude.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { createBountyAction, type CreateBountyState } from "@/server/actions/bounties";
import { Button, Field, Input, Panel, PanelHeader, Select } from "@/components/ui/primitives";

const INITIAL: CreateBountyState = { ok: false };

/** A real shop, so the geofence rule has something to measure against. */
const DEMO_STORE = {
  lat: "37.7749",
  lng: "-122.4194",
  name: "Ferry Plaza Market",
  address: "1 Ferry Building, San Francisco, CA",
};

export function CreateBountyForm() {
  const [state, formAction, pending] = useActionState(createBountyAction, INITIAL);
  const [copied, setCopied] = useState(false);

  const skuRef = useRef<HTMLInputElement>(null);
  const storeRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);

  // A new bounty means a new link, so any earlier "copied" state is stale.
  useEffect(() => {
    setCopied(false);
  }, [state]);

  function fillDemoStore() {
    if (storeRef.current) storeRef.current.value = DEMO_STORE.name;
    if (addressRef.current) addressRef.current.value = DEMO_STORE.address;
    if (latRef.current) latRef.current.value = DEMO_STORE.lat;
    if (lngRef.current) lngRef.current.value = DEMO_STORE.lng;
    if (skuRef.current && skuRef.current.value === "") skuRef.current.value = "4471";
  }

  async function copyLink() {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Panel className="h-fit">
      <PanelHeader
        title="Post a bounty"
        hint="An agent's request. The reward is paid to whoever proves it."
      />

      <form action={formAction} className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU">
            <Input ref={skuRef} name="sku" placeholder="4471" required maxLength={64} />
          </Field>
          <Field label="Expected price" hint="what the tag should read">
            <Input name="expectedValue" placeholder="6.00" required inputMode="decimal" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Reward" hint="paid on success">
            <Input name="reward" placeholder="6.00" required inputMode="decimal" />
          </Field>
          <Field label="Tolerance">
            <div className="flex items-center gap-2">
              <Input name="tolerancePct" type="number" defaultValue={10} min={0} max={100} />
              <span className="num text-xs text-faint">%</span>
            </div>
          </Field>
        </div>

        <Field label="Store">
          <Input ref={storeRef} name="storeName" placeholder="Ferry Plaza Market" required />
        </Field>

        <Field label="Address">
          <Input ref={addressRef} name="storeAddress" placeholder="1 Ferry Building, San Francisco" required />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Latitude">
            <Input ref={latRef} name="storeLat" placeholder="37.7749" required inputMode="decimal" />
          </Field>
          <Field label="Longitude">
            <Input ref={lngRef} name="storeLng" placeholder="-122.4194" required inputMode="decimal" />
          </Field>
          <Field label="Radius">
            <div className="flex items-center gap-2">
              <Input name="radiusM" type="number" defaultValue={250} min={25} max={5000} />
              <span className="num text-xs text-faint">m</span>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Requester email">
            <Input name="requesterEmail" type="email" placeholder="agent@example.com" required />
          </Field>
          <Field label="Expires in">
            <Select name="expiresInHours" defaultValue="24">
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
            </Select>
          </Field>
        </div>

        <Field
          label="Mock vision scenario"
          hint="demo only — the model is a deterministic stand-in until a vision key exists"
        >
          <Select name="mockScenario" defaultValue="match">
            <option value="match">Match — the tag reads the expected price</option>
            <option value="mismatch">Mismatch — the tag reads something else</option>
            <option value="low_confidence">Low confidence — a partly hidden tag</option>
            <option value="unreadable">Unreadable — no tag in frame</option>
          </Select>
        </Field>

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Posting…" : "Post bounty"}
          </Button>
          <Button type="button" variant="ghost" onClick={fillDemoStore}>
            Use demo store
          </Button>
        </div>

        {state.error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {state.error}
          </p>
        ) : null}

        {state.ok && state.link ? (
          <div className="rounded-md border border-money/30 bg-money/10 p-3">
            <p className="label text-money">Bounty posted</p>
            <p className="mt-1 text-xs text-muted">
              Send this link to someone near the store. It is single use, and only the hash of it
              is ever stored.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={state.link}
                aria-label="Claim link"
                onFocus={(event) => event.currentTarget.select()}
                className="num min-w-0 flex-1 rounded border border-line bg-ink px-2 py-1.5 text-[11px] text-text"
              />
              <Button type="button" size="sm" onClick={copyLink} variant="primary">
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : null}
      </form>
    </Panel>
  );
}
