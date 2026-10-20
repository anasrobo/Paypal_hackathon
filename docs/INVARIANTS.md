# The eight money-safety invariants

GroundTruth pays a stranger. That is the whole product, and it is also the
worst thing a piece of software can get wrong. A double payment is not a bug
report; it is a person who was paid twice for one photo of one shelf, and a
PayPal account they cannot close.

So the safety properties are not written down and hoped for. Each one is a
**mechanism** — a database constraint, a compare-and-swap, a pure function —
and each one has a **test that would fail if the mechanism were removed**.

Every test below runs against a **real Postgres**, not a mock, because the
invariants *are* database constraints. A mocked `UNIQUE` proves nothing about
the only thing that matters.

**Where the tests live:** `tests/integration/money-safety.test.ts`
(103 tests, plus `tests/unit/` for the pure domain).

Run them with `npm test`. The database is booted for you — there is no Docker
requirement, because the suite uses an embedded Postgres binary.

---

## 1 — Only a `VERIFIED` bounty may enter `PAYING`

**Mechanism.** Three layers, in order:

1. The transition table in `src/domain/state-machine.ts` has no edge into
   `PAYING` except `VERIFIED → PAYING`.
2. The state change is a **compare-and-swap**:
   `UPDATE bounties SET status = $to WHERE id = $id AND status = $from`.
   Zero rows affected means the world moved underneath the caller, and the
   payout is abandoned rather than attempted.
3. A Postgres trigger, `enforce_bounty_status_transition()`, refuses an
   illegal transition at the database level — even if the application check is
   ever bypassed.

**Test.** `the happy path` → `invariant 1`. The database is asked to move a
bounty from every other status into `PAYING` and is expected to refuse all of
them, including when the `WHERE` clause matches and the trigger is the only
thing standing in the way.

**Why it matters.** A retried request, a double-click, or two functions
racing cannot start two payouts, because only one of them can win the
compare-and-swap.

---

## 2 — The gate fails closed, and the model can never cause a payout

**Mechanism.** `evaluateGate()` in `src/domain/gate.ts` is **pure**: no I/O, no
clock, no environment, no randomness. The server's time is injected.

The model output feeds **two** of the six rules (`model_verdict_match` and
`model_confidence_min`) and contributes to one more (`value_tolerance_10pct`).
It can only ever cause a rule to **fail**. There is no code path in the
application in which a model output produces a `VERIFIED` bounty —
`evaluateGate()` is the only function that can.

Every rule **fails closed**: a missing, null or malformed input fails its
rule. It is never skipped and never defaulted to "pass".

**Test.** `the happy path` (a perfect submission passes all six and reaches
`VERIFIED`) and `invariant 2` (a perfect model output with a failing
geofence is still rejected).

**The adversarial case.** The model says `match` at 0.99 confidence, the price
is perfect, the photo is valid — and the capture is 900 m from the store. The
bounty is `REJECTED` and **zero payout rows exist**.

---

## 3 — Exactly one payout per bounty

**Mechanism.** `payouts.bounty_id` is `UNIQUE`. The payout row is inserted
**before** the provider is called:

```
INSERT INTO payouts (bounty_id, …) VALUES (…) ON CONFLICT (bounty_id) DO NOTHING
```

If the insert affects zero rows, a payout already exists, and the function
returns `null` **without calling PayPal at all**. The database is the gate, so
it holds even if two requests reach that line at the same instant.

**Test.** `invariant 3` — a second `insertPayout` returns `null`, and a second
`payVerifiedBounty` throws instead of paying again. The rehearsal asserts the
same thing end to end.

**Why it matters.** This is the last line of defence against paying a stranger
twice. A failed payout is **never retried automatically** — it becomes
`PAYOUT_FAILED` and a human resolves it. Auto-retry is the conventional
choice and it is the one that risks a double payment.

---

## 4 — The idempotency key is deterministic

**Mechanism.** `senderBatchId(bountyId)` returns `gt-bounty-{bountyId}-v1`.
It is derived from the bounty id and **nothing else** — never a random
value, never a timestamp. A retry after a crash reuses the same key, and
PayPal returns the original batch instead of creating a second one.

**Test.** `invariant 4` — the key is stable, contains no timestamp, and is
the key actually stored against the payout row.

**Why it matters.** The application-level `UNIQUE` protects the database.
The deterministic key protects PayPal's side of the same promise, so a retry
cannot become a second batch even if the application crashed between the
insert and the call.

---

## 5 — A replayed webhook changes nothing

**Mechanism.** The webhook handler **inserts the event id first**:

```
INSERT INTO webhook_events (paypal_event_id, …) VALUES (…) ON CONFLICT DO NOTHING RETURNING id
```

Zero rows returned means the event is a **replay**, and the handler returns
200 without touching a single row. A verified event always returns 200 — even
when it is ignored — so PayPal never enters a retry storm.

**Test.** `invariant 5` — the second insert of the same event id returns
`null`. The rehearsal goes further: it re-delivers the *real signed webhook*
and asserts the bounty does not move and there is still exactly one payout.

---

## 6 — Webhook authenticity

**Mechanism.** The signature is computed over the **raw body bytes**, before
any parsing. A signature is an HMAC over bytes, and re-serialising a parsed
object changes them, so parsing first would break every signature.

```
const raw = await req.text();     // raw bytes, before any JSON.parse
const ok = await provider.verifyWebhook(headers, raw);
```

The comparison is **constant time** (`timingSafeEqual`). An unverified event
is rejected with 401 and changes nothing — it is never even parsed.

**Test.** `invariant 6` — a tampered body and a missing signature are both
refused; the valid one is accepted.

---

## 7 — The server alone decides the amount

**Mechanism.** The amount is read from the **`bounties` row**, inside the
service that pays:

```ts
const amountCents = bounty.rewardCents;
```

Never from a request body. Never from a model response. Never from a client.
The request that triggers a payout carries no amount at all — it carries a
claim token, and the amount is whatever the database says the reward is.

**Test.** `invariant 7` — a bounty with an expected value of 600 cents and a
reward of 250 cents pays **250** cents, because the reward is what the
requester offered. The rehearsal asserts the same thing against a real
payout.

**Why it matters.** If the amount could be influenced by the request, the
whole system would be a payment API with extra steps. It is not: the request
cannot ask for more money.

---

## 8 — Sandbox only, and no live endpoint anywhere

**Mechanism.** Two independent layers:

1. **In code.** The provider registry has exactly two implementations, `mock`
   and `sandbox`. There is no `live`. The environment schema is a **closed
   enum** — `z.enum(["mock", "sandbox"])` — so no value outside it can be
   accepted. The sandbox base URL is a module constant asserted at runtime to
   contain `sandbox`.
2. **In the repository.** `scripts/check-no-live-paypal.mjs` scans every
   tracked file for a live PayPal host or a live provider mode and **fails the
   build** if it finds one. It runs in CI.

**Test.** `invariant 8` — the registry only ever offers `mock` or `sandbox`,
and the environment schema accepts those two and nothing else.

**Why it matters.** A single stray live endpoint in a config file would move
real money. The guard makes that impossible to merge, and the closed enum
makes it impossible to configure.

---

## The two that are not in the list, and are still true

- **The state machine is total.** `src/domain/state-machine.ts` is the only
  place a status can change, and it has no edge that skips a step. A Postgres
  trigger enforces the same table independently.
- **Nothing is auto-retried.** A failed payout is a human's problem, on
  purpose. See invariant 3.

---

## Reproducing them

```bash
npm test              # the whole suite, against a real Postgres
npm run rehearse      # the money path, end to end, headless
npm run verify        # lint, typecheck and the five guard scripts
```

The rehearsal is the one to watch. It posts a bounty, accepts it, proves it,
pays it, and then checks five things that must be true afterwards — including
that a **rejected** bounty leaves **no payout row at all**. It exits non-zero
if any of them is not.
