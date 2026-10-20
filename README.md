# GroundTruth

**An AI agent needs a fact that only exists in the physical world. GroundTruth
posts a micro-bounty for it, a human proves it with a phone camera and GPS, a
deterministic rule set decides, and PayPal Payouts sends the money to that
person's email in seconds.**

Built with **PayPal Payouts** (money out to a stranger — not a checkout),
**PayPal webhooks** (signed, idempotent, replay-safe), and a **vision model**
that is advisory only: it reads the price tag, but a deterministic rule set
makes the decision.

> *Is SKU 4471 on the shelf at the store on Market Street, and does the tag
> read $6.00?* — That is a question a procurement agent cannot answer from the
> internet. GroundTruth lets the agent ask a human, and pays them for the
> answer.

---

## The 20-second demo

1. A bounty card on the console: `SKU 4471 · Ferry Plaza Market · $6.00`.
2. A phone photo of the shelf, with a GPS fix and the distance to the store.
3. The model reads the tag. **Six rules go green.**
4. `PAID — $6.00 delivered to sam@shopper.test`

No cart. No card form. No checkout SDK. A checkout SDK physically cannot do
this — **Payouts is a different PayPal product, and it is the product, not a
feature bolted on.**

---

## Quickstart (5 minutes)

```bash
git clone https://github.com/anasrobo/Paypal_hackathon.git
cd Paypal_hackathon
npm ci                 # the lockfile is committed; never `npm install`
cp .env.example .env.local
npm run db:migrate     # applies db/migrations/*.sql, idempotently
npm run db:seed        # 40+ rows, one of them already paid
npm run dev            # http://localhost:3000
```

No Docker required. The test suite boots its own Postgres.

You need one value to see the whole product:

| Variable | What it does | Without it |
|---|---|---|
| `DATABASE_URL` | Postgres (the Supabase **pooler** host) | the app cannot start |
| `TOKEN_SECRET` | signs the claim links | a development placeholder is used |
| `PAYPAL_PROVIDER` | `mock` (default) or `sandbox` | `mock` |
| `VISION_PROVIDER` | `mock` (default) or a real multimodal API | `mock` |

Everything else has a working default. **The demo runs end to end with
`PAYPAL_PROVIDER=mock`** — the mock provider delivers a genuinely signed
webhook through the real handler, so the real code path is exercised, not a
simulation of it.

### Try it

```bash
npm test           # 103 tests, against a real Postgres
npm run rehearse   # the whole money path, headless; non-zero on any miss
npm run verify     # lint, typecheck, and five guard scripts
npm run e2e        # Playwright, 390 px and 1280 px, with screenshots
```

---

## The judges' 60-second path

Three links. No setup. **Live now at
[`groundtruth-ten-beta.vercel.app`](https://groundtruth-ten-beta.vercel.app).**

1. **[The console](https://groundtruth-ten-beta.vercel.app/)** — post a bounty, get a
   claim link.
2. **[The claim link](https://groundtruth-ten-beta.vercel.app/claim/…)** — open it on
   your phone. Accept it, photograph a shelf, submit.
3. **[The evidence record](https://groundtruth-ten-beta.vercel.app/bounty/…)** — six
   green rules, the model's opinion, and the payout.

And if there is time: **[the ops ledger](https://groundtruth-ten-beta.vercel.app/ops)**
— every bounty in an AG Grid, with a natural-language query layer.

---

## How it works

```
┌─ Browser (phone) ──────────────────────────────────────────┐
│ 1. downsizes the photo to ≤1600 px / q0.82  (~250–400 KB)  │
│ 2. reads GPS, and shows the distance to the store           │
│ 3. PUTs the evidence straight to storage ───────────┐      │
└─────────────────────────────────────────────────────┼──────┘
                                                      │ signed upload URL
                                                      ▼
                                   Supabase Storage (private)
                                                      │
┌─ Browser ── POST /api/claim (JSON only) ────────────┤     │
│                                                      ▼     │
│  ┌──────────── Vercel function ───────────────────────┐   │
│  │ 1. verify the single-use claim token (HMAC)        │   │
│  │ 2. insert the evidence row   (bounty_id UNIQUE)   │   │
│  │ 3. CAS transition  CLAIMED → SUBMITTED → VERIFYING │   │
│  │ 4. vision provider (mock | real) → ADVISORY output │   │
│  │ 5. evaluateGate()  ← PURE, six deterministic rules │   │
│  │ 6. VERIFIED → insert the payouts row (UNIQUE)      │   │
│  │            BEFORE the provider call                │   │
│  │          → PAYING → payPalProvider.createPayout()  │   │
│  │ 7. the mock provider self-delivers a SIGNED        │   │
│  │    webhook through the same handler the route uses │   │
│  └───────────────────────────────────────────────────┘   │
│         │                                            │      │
│         ▼                                            ▼      │
│   Supabase Postgres                    POST /api/paypal/webhook
│   (Supavisor pooler :6543)            verify sig → insert-first
│                                       idempotency → PAYING→PAID
└───────────────────────────────────────────────────────┘
```

Three seams make the whole thing work with no credentials:

1. **`VisionProvider`** — `mock` today, a real model in one env var.
2. **`PayPalProvider`** — `mock` today (it self-delivers a *real signed
   webhook* through the *same handler* the HTTP route uses), `sandbox` later.
   **There is no `live` option and the repository has no live endpoint string
   in it.**
3. **`StorageProvider`** — a private Supabase bucket, signed URLs only.

---

## The six rules

The model is **advisory**. It contributes to two rules and can only ever cause
a rule to *fail*. `evaluateGate()` is the only function in the application
that may produce a `VERIFIED` bounty.

| # | Rule | Condition | Fails closed on |
|---|---|---|---|
| 1 | `model_verdict_match` | the model read `match` | missing or malformed output |
| 2 | `model_confidence_min` | confidence ≥ 0.75 | null, NaN |
| 3 | `freshness_30m` | captured within 30 min, not >5 min in the future | missing timestamp |
| 4 | `geo_250m` | haversine ≤ 250 m from the store | missing coordinates, or accuracy > 250 m |
| 5 | `value_tolerance_10pct` | \|observed − expected\| / expected ≤ 0.10 (integer maths) | expected ≤ 0, observed null |
| 6 | `media_valid` | mime ∈ {jpeg, png, webp} **and** under 10 MB | missing media, oversized |

**All six are always returned**, so the evidence screen shows a complete
green/red checklist rather than a single verdict.

---

## The eight money-safety invariants

Each one is a mechanism, and each one has a test that fails if the mechanism
is removed. Full detail in **[docs/INVARIANTS.md](docs/INVARIANTS.md)**.

| # | Invariant | Mechanism | Proved by |
|---|---|---|---|
| 1 | only `VERIFIED` may enter `PAYING` | transition table + compare-and-swap + a Postgres trigger | `money-safety.test.ts` → *invariant 1* |
| 2 | the gate fails closed; the model can never cause a payout | `evaluateGate` is pure; only its boolean gates the transition | *invariant 2* + the happy path |
| 3 | exactly one payout per bounty | `payouts.bounty_id UNIQUE`, inserted **before** the provider call | *invariant 3* + `npm run rehearse` |
| 4 | the idempotency key is deterministic | `gt-bounty-{id}-v1`, never random, never a timestamp | *invariant 4* |
| 5 | a replayed webhook changes nothing | `webhook_events.paypal_event_id UNIQUE` + `ON CONFLICT DO NOTHING` | *invariant 5* + the rehearsal |
| 6 | webhook authenticity | HMAC over the **raw bytes**, `timingSafeEqual` | *invariant 6* |
| 7 | the server alone decides the amount | the amount is read from the bounty row, never from a request | *invariant 7* |
| 8 | sandbox only, no live endpoint anywhere | a closed enum, plus a repository-wide scan that fails the build | *invariant 8* + `check-no-live-paypal.mjs` |

A failed payout is **never retried automatically**. It becomes
`PAYOUT_FAILED` and a human resolves it. Auto-retry is the conventional
choice, and it is the one that risks paying a stranger twice.

---

## The four screens

| Route | What it is |
|---|---|
| `/` | the requester console — post a bounty, copy the claim link, watch the ledger |
| `/claim/[token]` | the mobile capture screen, designed at 390 px first |
| `/bounty/[id]` | the evidence record — the photo, the model, all six rules, the payout, the audit trail |
| `/ops` | the AG Grid ops ledger — server-paginated, custom renderers, custom theme, a natural-language query layer |

The ops ledger uses **AG Grid Community** with the **infinite row model**
(the Server-Side Row Model is Enterprise-only, and this repository is
GPL-3.0). It has a custom theme built from the app's own tokens, six custom
cell renderers — state pill, verdict badge, amount, signed evidence thumbnail,
identifier, end-to-end latency — and a hand-built **deterministic**
natural-language layer that compiles *"show failed payouts"* into the same
filter model a column filter produces, and says what it understood. An
unrecognised phrase returns *"I did not understand"* with the supported
intents. **It never guesses**, because a wrong filter is worse than no filter.

---

## Project layout

```
src/
├── app/                 the four screens, the five API routes, error pages
├── components/
│   ├── ui/              the primitive set: Button, Panel, StatusPill, Money…
│   ├── console/         the requester console
│   ├── claim/           the capture screen and the browser photo pipeline
│   ├── bounty/          the evidence record and the six-rule checklist
│   └── ops/             the AG Grid, its renderers and the NL query layer
├── domain/              PURE. No I/O, no env, no clock. types, errors, geo,
│                        money, state-machine, gate
├── ops/                 the pure ledger SQL builder
└── server/              env, db, tokens, storage, vision, paypal, services
db/migrations/           numbered SQL, applied by our own runner
scripts/                 migrate, guard scripts, the rehearsal
tests/unit/              the pure domain
tests/integration/       the eight invariants, against a real Postgres
e2e/                     Playwright, with committed screenshots
docs/                    BUILD_STATE, DECISIONS, TASK_QUEUE, ATTEMPTS,
                         DEMO, INVARIANTS, research/
```

**No directory named `lib/` anywhere.** That is a second, independent defence
against a hazard inherited from the repository's previous Python template,
whose `.gitignore` contained a bare `lib/` entry that would have silently
untracked `src/lib/`. The `.gitignore` was replaced, and
`scripts/check-ignore.mjs` asserts the sentinels on every build.

---

## Licence

**GNU General Public License v3.0.** See [LICENSE](LICENSE).

This matters for one decision: **AG Grid Enterprise is commercial, and this
repository is GPL-3.0.** The project therefore uses AG Grid **Community**
(MIT) only, and `scripts/check-aggrid.mjs` fails the build if an Enterprise
package, a licence key, a Server-Side Row Model or a legacy CSS theme ever
appears.

The research that justified the idea — including a 225-repository census of
the competition — is in [`docs/research/`](docs/research/).
