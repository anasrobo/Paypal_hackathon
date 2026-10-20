# Task queue

> Work strictly top-down. A task may not start until every task it depends on
> is checked. New work is **appended at the bottom** with a `[NEW]` prefix and
> never inserted in the middle.
>
> Line format, parsed by `scripts/check-protocol.mjs`:
>
> ```
> - [ ] T2-06 Title (deps: T2-01) (files: src/server/providers/paypal/mock.ts) (accept: npm test -- paypal)
> ```
>
> `accept` is the command that proves the task is done. `files` is the write
> allow-list — touching anything else means the task is not what it claimed to be.

## P0 — Safe bootstrap

- [x] T0-01 Clone repo locally, create `feat/groundtruth-bootstrap` (deps: none) (files: -) (accept: git branch --show-current)
- [x] T0-02 Replace `.gitignore`, verify with `git check-ignore` sentinels (deps: T0-01) (files: .gitignore) (accept: npm run check:ignore)
- [x] T0-03 App skeleton + dependencies (deps: T0-01) (files: package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs src/app/**) (accept: npm run build)
- [x] T0-04 Protocol docs + five guard scripts (deps: T0-01) (files: AGENTS.md docs/BUILD_STATE.md docs/TASK_QUEUE.md docs/DECISIONS.md docs/ATTEMPTS.md scripts/check-*.mjs scripts/next-task.mjs) (accept: npm run check:protocol)
- [x] T0-05 Copy the strategy report into `docs/research/` (deps: T0-01) (files: docs/research/**) (accept: test -f docs/research/DEEP_RESEARCH_PayPal_AI_Hackathon_2026.md)

## P1 — Pure domain (no DB, no env, no network)

- [x] T1-01 `src/domain/types.ts` + `src/domain/errors.ts` (deps: T0-03) (files: src/domain/types.ts src/domain/errors.ts) (accept: npm run typecheck)
- [x] T1-02 `src/domain/geo.ts` haversine (deps: T1-01) (files: src/domain/geo.ts) (accept: npm test -- geo)
- [x] T1-03 `src/domain/money.ts` cents, formatting, `senderBatchId` (deps: T1-01) (files: src/domain/money.ts) (accept: npm test -- money)
- [x] T1-04 `src/domain/state-machine.ts` transitions + `assertTransition` (deps: T1-01) (files: src/domain/state-machine.ts) (accept: npm test -- state-machine)
- [x] T1-05 `src/domain/gate.ts` the six deterministic rules (deps: T1-02 T1-03 T1-04) (files: src/domain/gate.ts) (accept: npm test -- gate)
- [x] T1-06 Unit tests for the whole domain, including boundary and adversarial cases (deps: T1-05) (files: tests/unit/**) (accept: npm test)

## P2 — Server core

- [x] T2-01 `src/server/env.ts` zod-validated, crashes on a placeholder secret (deps: T0-03) (files: src/server/env.ts) (accept: npm run typecheck)
- [x] T2-02 `src/server/db/client.ts` one pool, pooler guard (deps: T2-01) (files: src/server/db/client.ts) (accept: npm run typecheck)
- [x] T2-03 `src/server/db/types.ts` + `src/server/db/queries.ts` (deps: T2-02) (files: src/server/db/**) (accept: npm run typecheck)
- [x] T2-04 `db/migrations/001_init.sql` `002_indexes.sql` `003_rls.sql` + state trigger (deps: T2-01) (files: db/migrations/**) (accept: npm run db:migrate)
- [x] T2-05 `scripts/migrate.ts` own runner, idempotent, re-runnable (deps: T2-02 T2-04) (files: scripts/migrate.ts) (accept: npm run db:migrate)
- [x] T2-06 `src/server/tokens.ts` HMAC claim tokens, single use (deps: T2-01) (files: src/server/tokens.ts) (accept: npm test -- tokens)
- [x] T2-07 `src/server/storage.ts` Supabase Storage, signed URLs only (deps: T2-01) (files: src/server/storage.ts) (accept: npm run typecheck)
- [x] T2-08 `src/server/vision/*` provider interface + deterministic mock (deps: T2-01) (files: src/server/vision/**) (accept: npm test -- vision)
- [x] T2-09 `src/server/paypal/*` provider interface, mock, sandbox, HMAC signing (deps: T2-01) (files: src/server/paypal/**) (accept: npm test -- paypal)
- [x] T2-10 `src/server/services/*` bounty, verification, payout, reconcile (deps: T2-03 T2-08 T2-09) (files: src/server/services/**) (accept: npm test -- integration)
- [x] T2-11 `src/ops/ledger-query.ts` one pure SQL builder (deps: T2-03) (files: src/ops/ledger-query.ts) (accept: npm test -- ledger-query)
- [ ] T2-12 Integration tests: the eight money-safety invariants (deps: T2-10) (files: tests/integration/**) (accept: npm test -- integration)

## P3 — Route handlers

- [ ] T3-01 `src/app/api/health/route.ts` (deps: T2-02) (files: src/app/api/health/**) (accept: npm run rehearse)
- [ ] T3-02 `src/app/api/claim/route.ts` (deps: T2-10) (files: src/app/api/claim/**) (accept: npm run rehearse)
- [ ] T3-03 `src/app/api/paypal/webhook/route.ts` (deps: T2-09 T2-10) (files: src/app/api/paypal/webhook/**) (accept: npm test -- webhook)
- [ ] T3-04 `src/app/api/cron/reconcile/route.ts` (deps: T2-10) (files: src/app/api/cron/reconcile/**) (accept: npm run rehearse)
- [ ] T3-05 `src/app/api/ops/ledger/route.ts` paged + cached count (deps: T2-11) (files: src/app/api/ops/ledger/**) (accept: npm test -- ledger-query)
- [ ] T3-06 `scripts/rehearse.ts` headless money path, non-zero exit on any miss (deps: T3-02 T3-03) (files: scripts/rehearse.ts) (accept: npm run rehearse)

## P4 — Screens and the AG Grid ledger

- [ ] T4-01 UI primitives in `src/components/ui/` (deps: T0-03) (files: src/components/ui/**) (accept: npm run build)
- [ ] T4-02 `src/app/layout.tsx` + requester console `src/app/page.tsx` (deps: T4-01 T2-10) (files: src/app/layout.tsx src/app/page.tsx src/components/console/**) (accept: npm run build)
- [ ] T4-03 Capture screen `src/app/claim/[token]/page.tsx` (deps: T4-02 T2-07) (files: src/app/claim/** src/components/claim/**) (accept: npm run build)
- [ ] T4-04 Evidence view `src/app/bounty/[id]/page.tsx` (deps: T4-02) (files: src/app/bounty/** src/components/bounty/**) (accept: npm run build)
- [ ] T4-05 `/ops` AG Grid: infinite row model, custom renderers, theme, NL query (deps: T4-02 T3-05) (files: src/app/ops/** src/components/ops/**) (accept: npm test -- nl-query)
- [ ] T4-06 Responsive pass at 390px and 1280px, every state designed (deps: T4-03 T4-04 T4-05) (files: src/app/** src/components/**) (accept: npm run e2e)

## P5 — Seed, rehearsal, end-to-end

- [ ] T5-01 `db/seed.ts` deterministic and idempotent (deps: T2-10 T2-07) (files: db/seed.ts) (accept: npm run db:seed)
- [ ] T5-02 `e2e/demo-flow.spec.ts` and `e2e/ops.spec.ts` (deps: T4-06 T5-01) (files: e2e/** playwright.config.ts) (accept: npm run e2e)
- [ ] T5-03 Committed screenshots at 390px and 1280px (deps: T5-02) (files: e2e/screenshots/**) (accept: npm run e2e)

## P6 — Deploy

- [ ] T6-01 New isolated Supabase project, migrations applied twice (deps: T5-01) (files: docs/DECISIONS.md) (accept: npm run db:migrate)
- [ ] T6-02 Vercel project in scope `duckhunt`, no gitRepository (deps: T6-01) (files: vercel.json docs/DECISIONS.md) (accept: npm run build)
- [ ] T6-03 Environment variables set, secrets marked Sensitive (deps: T6-01 T6-02) (files: docs/DECISIONS.md) (accept: npm run build)
- [ ] T6-04 First production deploy, function count asserted, health checked (deps: T6-03) (files: docs/BUILD_STATE.md) (accept: npm run verify)
- [ ] T6-05 GitHub finalisation: branch, PR, squash merge, About-panel licence (deps: T6-04) (files: -) (accept: git log --oneline -1)

## P7 — Submission

- [ ] T7-01 `README.md` with a 5-minute quickstart and a judges' 60-second path (deps: T6-04) (files: README.md) (accept: npm run verify)
- [ ] T7-02 `docs/DEMO.md` and `docs/INVARIANTS.md` (deps: T6-04) (files: docs/DEMO.md docs/INVARIANTS.md) (accept: npm run verify)
- [ ] T7-03 Devpost entry, YouTube video under 3 minutes, submitted before 9 Nov (deps: T7-01 T7-02) (files: -) (accept: manual)
