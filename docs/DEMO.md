# The demo

This is the literal click path, with timings. Three minutes, and it has to
work on a phone that is not yours, on a network that is not yours, in front
of people who are not patient.

**Rehearse it.** `npm run rehearse` drives the entire money path headlessly
and exits non-zero if anything is wrong. Run it before every demo. It takes
about four seconds.

---

## Before the demo (5 minutes, once)

1. **Open the deployed URL in a private window.** If it does not load, the
   deployment is cold or the database is unreachable. Do not find this out
   live.
2. **Check the health endpoint.** It is the one URL that must be green:
   ```
   GET /api/health  →  200
   { "status": "ok", "db": "ok", "provider": "mock", "mode": "sandbox" }
   ```
   `db` must be `ok`. If it is not, the Supabase project has been paused —
   run the keepalive cron, or re-seed.
3. **Re-seed.** `npm run db:seed` wipes the ledger and rebuilds it: one paid
   hero row, one rejected row, one failed payout, and about forty more so the
   ops grid is not empty. It prints a live claim link.
4. **Open the claim link on the actual phone** you will film with. Confirm the
   camera opens and the location readout appears. If the phone has no SIM or
   no data, the demo does not work — find this out now.
5. **Check the console.** `GET /` must show the KPI strip and a populated
   bounty list.
6. **Check the ops ledger.** `GET /ops` must show rows, not an empty grid.
   Ask the ledger *"show failed payouts"* and confirm the chip appears.

---

## The three-minute path

### 0:00 — The console (30 s)

Open `/`.

> "An agent needs a fact that only exist in the physical world. It posts a
> bounty. A human proves it. **A deterministic rule set — not the model —
> decides.** And PayPal Payouts sends the money."

Click **Post bounty**, press **Use demo store**, and press **Post bounty**.
The claim link appears. Copy it.

*Optional, if there is time:* point at the KPI strip — `PAID`, and the total
paid out.

### 0:30 — The phone (60 s)

Open the claim link on the phone. The screen shows the SKU, the store, the
expected price, and **You earn $6.00**.

Tap **Accept and earn the reward**. Type an email that is yours.

> "The link is single use, and only the hash of it is ever stored. One live
> link per bounty, so one person can claim each reward."

### 1:30 — The proof (60 s)

Point the camera at a shelf. Take the photo. The screen shows the distance to
the store and the accuracy of the fix.

> "The photo is downscaled in the browser and uploaded **straight to private
> storage**. The image bytes never pass through a function."

**If there is no camera, or the phone refuses permission:** press
**"No camera? Use the disclosed demo fixture instead"**. It draws a price tag
and places the capture at the store. It is disclosed in the UI on purpose.

Tap **Submit evidence and get paid**.

### 2:30 — The money (30 s)

The screen shows **Paid**, the amount, the payee, the PayPal batch id, and
**six green rules**.

> "Six deterministic rules. The model read the price tag and contributed to
> two of them. It can never cause a payout on its own."

Open the **full evidence record**. The photo, the model's opinion, all six
rules with their actual and expected values, the payout, and the append-only
audit trail.

### 3:00 — The ledger (30 s, optional)

Open `/ops`.

> "Every bounty, server-paginated. Custom renderers, a custom theme, and a
> natural-language layer that compiles a phrase into the same filter model a
> column filter produces."

Type **"paid over 5 dollars"** into the ask box. The chip says what it
understood. Then type **"banana"**.

> "It refuses to guess. A wrong filter is worse than no filter, because an
> operator would act on it."

---

## The questions you should expect

**"Is the model deciding whether to pay?"**
No. `evaluateGate()` is a pure function — no I/O, no clock, no randomness —
and it is the only thing in the application that may produce a `VERIFIED`
bounty. The model feeds two of the six rules and can only ever cause a rule
to *fail*. The adversarial case is a test: the model says `match` at 0.99
confidence, everything is perfect, and the capture is 900 m from the store.
Result: `REJECTED`, and zero payout rows exist.

**"What if PayPal calls the webhook twice?"**
Nothing happens. The event id is inserted **first**; a duplicate inserts zero
rows and the handler returns 200 without touching a row. The rehearsal
re-delivers the real signed webhook and asserts the bounty does not move.

**"What if the request asks for a bigger amount?"**
It cannot. The amount is read from the `bounties` row inside the paying
service. The request carries no amount at all — it carries a claim token.

**"Can a person be paid twice?"**
No. `payouts.bounty_id` is `UNIQUE`, and the payout row is written
**before** the provider is called, so a second attempt inserts zero rows and
never reaches PayPal. A failed payout is never retried automatically — a
human resolves it.

**"Is this a real PayPal integration?"**
The provider interface has two implementations, `mock` and `sandbox`. There is
no `live`, the environment schema is a closed enum, and a repository-wide
scan fails the build if a live PayPal host appears anywhere. The mock is not
a stub of the integration: it delivers a **genuinely signed webhook** through
the **same handler** the HTTP route uses, so signature verification, the
insert-first idempotency and the state transition all really execute.

Full detail: [`docs/INVARIANTS.md`](INVARIANTS.md).

---

## The backup clip

**Record a backup video before the demo, not during it.** If the second
person's phone fails — no camera, no data, a dead battery — you are not
debugging on stage.

1. Run the same flow on a **second phone** while screen-recording it, or
   screen-record the desktop browser at 390 px with Playwright:
   ```bash
   npm run e2e
   ```
   The committed screenshots in `e2e/screenshots/` are the frames of exactly
   this flow.
2. Keep the clip under three minutes. The rules say the video must be under
   three minutes.
3. Show the **evidence record** in the clip, not just the happy path. A judge
   who sees the six rules and a rejected example believes the rule set.

---

## If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| The console is empty | the database is paused or unreachable | `GET /api/health`; if `db` is not `ok`, wait for the keepalive or re-seed |
| The claim link says it cannot be used | it was already redeemed, or a newer link was issued | press **Copy claim link** on the console for a fresh one |
| The camera does not open | the browser needs HTTPS | a plain HTTP origin cannot use the camera; the deployment is HTTPS, a LAN address is not |
| The location never appears | permission denied | the screen offers manual coordinates; type them in |
| The photo is rejected | it is more than 30 minutes old, or you are more than 250 m from the store | the fix is to be at the store, with a fresh photo |
| The payout stays `PAYING` | the webhook did not arrive | wait; the reconciler runs on every read of the ledger and resolves it from the provider |
| `PAYOUT_FAILED` | the provider refused the payout | a human resolves it. It is never retried automatically, on purpose |

---

## The judging window

Judging runs **1–15 December**. A free Supabase project is paused after seven
days of inactivity, and the deployed app would answer with an error instead
of a demo.

- A **daily keepalive cron** pings the database every day.
- `npm run db:seed` rebuilds the ledger in about twenty seconds, so even if
  the project was paused, it can be woken and re-seeded.
- `/api/health` says whether the database is answering.

**Check `/api/health` every few days during the window.** It is one request,
and it is the difference between a working demo and a 500.
