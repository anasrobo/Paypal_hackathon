# AGENTS.md

> The entry point for anyone — human or agent — working on this repository.
> Read it before you change anything.

## What this application is

GroundTruth lets an AI agent buy a fact that only exists in the physical
world. The agent posts a micro-bounty ("is SKU 4471 on the shelf at this
store, and what does the price tag say?"). A human nearby accepts, photographs
the shelf from a phone, and submits it with their location. A vision model
reads the price tag. **A deterministic rule set, not the model, decides.** If
it passes, PayPal Payouts sends money to that person's email in seconds.

One vertical. Shelf and price verification for procurement agents.

Why it is interesting: every other project in this hackathon collects money
*from* a buyer. This one pushes money *out* to a stranger. A checkout SDK
cannot do that — Payouts is a different PayPal product, and it is the product
rather than a feature bolted onto it.

## High-level architecture

```text
browser (phone)                      Vercel functions (<= 9)                Supabase
---------------                      ----------------------                ---------
1. downscale photo
   to <=1600px q0.82  ------------->
2. read GPS
3. PUT evidence + thumb  ----------> private bucket, signed upload URL
4. POST /api/claim (JSON only) ------------------------------------->  Postgres
   5. verify single-use claim token                                  (pooler)
   6. insert evidence row
   7. CAS CLAIMED -> SUBMITTED -> VERIFYING
   8. vision provider (mock | real)  ---- advisory only
   9. evaluateGate()  <- PURE, six deterministic rules
  10. VERIFIED -> insert payouts row (UNIQUE bounty_id)
                   BEFORE the provider call
      -> PAYING -> paypalProvider.createPayout()
  11. mock provider self-delivers a SIGNED webhook
                    |
                    v
      POST /api/paypal/webhook -- verify HMAC over raw bytes
                               -- insert-first idempotency
                               -- PAYING -> PAID
```

## Where things live

| Path | What is in it |
|---|---|
| `src/domain/` | **Pure.** No I/O, no env, no clock, no `next`, no `react`, no database. The state machine and the verification gate live here. ESLint forbids importing anything else from this folder. |
| `src/server/` | Everything that touches the outside world: env, database, tokens, storage, the vision and PayPal providers, and the services. |
| `src/ops/` | The pure SQL builder shared by the console, the ledger API and the KPI aggregate. |
| `src/app/` | Routes and route handlers. `api/` holds the five handlers. |
| `src/components/` | UI. `ui/` is the primitive set; the rest are feature components. |
| `db/migrations/` | Numbered, append-only, plain SQL, idempotent. |
| `scripts/` | The migration runner, the seed, the rehearsal, and the five guard scripts. |
| `docs/` | The protocol files, the demo script, the invariants, and the research. |

## Most important conventions

1. **Deterministic first, AI second.** The model contributes to two of six
   verification rules. It can only ever cause a rule to fail. `evaluateGate()`
   is the only thing that may produce `VERIFIED` or `REJECTED`.
2. **Fail closed.** A missing or malformed input fails its rule. It is never
   skipped. If the AI provider is unavailable, the submission stays
   `SUBMITTED` and retries — it is never auto-approved.
3. **The server alone decides the amount.** Payout amounts are read from the
   `bounties` row, never from a request body, never from a model response.
4. **PayPal sandbox only.** The live PayPal API host must appear nowhere in the
   repository — not in source, tests, docs, comments or examples.
   `npm run check:paypal` fails the build if it does.
5. **No secrets in Git, and no secrets in the client bundle.** Only
   `NEXT_PUBLIC_*` variables reach the browser. `.env*` is ignored and
   `.env.example` is the committed template.
6. **Uniform error shape.** `{ success: false, error: { code, message } }`.
   See `src/domain/errors.ts`.
7. **Smallest coherent change.** No drive-by refactors. A file that works is
   not rewritten to look tidier.
8. **One shared database pool.** `src/server/db/client.ts` is the only place
   that creates a client. Never create another engine in another module —
   connection count is a real constraint on a pooled Postgres.
9. **No directory named `lib/`.** See `docs/DECISIONS.md` D-004.
10. **AG Grid Community only.** No `ag-grid-enterprise`, no licence key.

## Critical boundaries

- `src/domain/**` must not import from `src/server/**`, `next`, `react`, or
  any `node:*` module. This is enforced by an ESLint rule, not by convention.
- `src/server/db/client.ts` is the only module that may create a database
  connection, and the only one that may read `DATABASE_URL`.
- `src/server/env.ts` is the only module that may read `process.env`.
- The **only** function that may write `bounties.status` is the transition
  helper in `src/server/services/`. Every write is a compare-and-swap.
- A `payouts` row is inserted **before** the PayPal call, never after.

## How to investigate before changing code

1. Read `docs/BUILD_STATE.md`. It says exactly where the build is and what
   was last verified. Do not re-explore the repository to find out.
2. Read `docs/TASK_QUEUE.md` and find the first unchecked task whose
   dependencies are satisfied.
3. Run `npm run next-task`. It prints that task, the files you may read, the
   files you may write, and the command that proves it is done.
4. If the answer to a question is in `docs/DECISIONS.md`, use it. Do not
   re-derive it, and do not re-litigate it.

## How changes should be scoped

- Work on the branch `feat/groundtruth-bootstrap`. Never commit to `main`
  directly; `main` moves only through a squash merge with `expectedHeadSha`.
- One task at a time. Finish it, verify it with its `accept` command, tick it
  in `docs/TASK_QUEUE.md`, update `docs/BUILD_STATE.md`, then move on.
- **Never re-read a file you have already read this session.** Cap any single
  read at 80 lines unless you are hunting a specific symbol.
- **Run the full test suite once per phase, not once per edit.** Use the
  targeted `accept` command in between.
- **No re-architecture after phase 2.** Adding a top-level `src/` directory or
  a new dependency after that point requires a new entry in
  `docs/DECISIONS.md`, and `npm run check:protocol` enforces it.

## The Three-Strike Rule

On any failing error, attempt at most **three distinct** fixes:

1. The obvious cause.
2. A different layer — configuration, versions, permissions.
3. A different assumption entirely.

If all three fail, **stop**. Write a BLOCKER block into `docs/BUILD_STATE.md`
with Error / Attempts / Hypothesis / Chosen fallback, then **execute the
fallback** and record the result. Never attempt a fourth diagnostic without a
new `docs/DECISIONS.md` entry. Log each attempt in `docs/ATTEMPTS.md`.

A working fallback beats a perfect integration you never finish.

## Licence

This repository is licensed under the **GNU General Public License v3.0** —
see `LICENSE`, which must stay byte-identical. All third-party dependencies
are MIT / Apache-2.0 / BSD and are GPL-3.0 compatible. **AG Grid is used under
the MIT Community licence only; no AG Grid Enterprise or Studio licence is
used, required, or referenced.** See `docs/DECISIONS.md` D-008.
