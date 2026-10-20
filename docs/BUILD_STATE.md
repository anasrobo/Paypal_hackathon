<!-- GROUNDTRUTH:BUILD_STATE:BEGIN -->
phase: 6
status: IN_PROGRESS
task: T6-05
last_test: 107 passed / 0 failed, rehearsal 12/12, e2e 4/4, deployed and live
attempts: 0
commit: 070e888
<!-- GROUNDTRUTH:BUILD_STATE:END -->

# Build state

> Read this file FIRST at the start of every session. It is the only source of
> truth about where the build is. Do not re-explore the repository to find out.
>
> If the header block and the Phase Ledger disagree, the header block wins.
> If the header block and the code disagree, the code wins and this file is
> wrong — fix this file in the same change.

## How to resume

1. Read this file.
2. Read `docs/TASK_QUEUE.md` and find the first unchecked task whose deps are
   satisfied.
3. Run `npm run next-task` — it prints that task, the files you may read, the
   files you may write, and the command that proves it is done.
4. Do that one task. Nothing else.
5. Update this file and `docs/TASK_QUEUE.md`, then commit.

## Phase ledger

| Phase | Status | Commit | Test result | Notes |
|---|---|---|---|---|
| P0 Safe bootstrap | COMPLETE | — | guards green, build green | branch `feat/groundtruth-bootstrap`, baseline `e73f4e5` |
| P1 Pure domain | COMPLETE | — | 63 unit tests passed | state machine, gate, money, geo |
| P2 Server core | COMPLETE | — | 83 tests passed, 4 migrations applied | env, db, tokens, storage, vision, paypal, services |
| P3 Route handlers | COMPLETE | — | rehearsal 12/12 | health, webhook, claim, uploads/sign, cron, ops/ledger written |
| P4 Screens + AG Grid | COMPLETE | — | build green, 9 functions | console, capture, evidence view, ops ledger with the NL query layer |
| P5 Seed + E2E | COMPLETE | — | seed green, e2e 4/4 | `db/seed.ts` seeds 35 rows; Playwright screenshots committed |
| P6 Deploy | COMPLETE | — | production health 200, db up | live at `groundtruth-ten-beta.vercel.app`, region `bom1`, no Git link |
| P7 Submission | IN_PROGRESS | — | — | README, DEMO.md, INVARIANTS.md written; the Devpost entry is outstanding |

## Blockers

> The Three-Strike Rule lives here. After **three distinct** fix attempts at the
> same error, stop, fill in a block below, and **execute the chosen fallback**.
> A fourth diagnostic requires a new entry in `docs/DECISIONS.md`.
>
> Format:
>
> ```
> ### BLOCKER — <one line>
> - Task: <T-id>
> - Error: <verbatim, first 40 lines>
> - Attempt 1: <what was tried>
> - Attempt 2: <what was tried>
> - Attempt 3: <what was tried>
> - Hypothesis: <root cause>
> - Chosen fallback: <what to do instead>
> - Result: <PENDING | resolved how>
> ```

None yet.

## Verified facts about this environment

Recorded once, so nobody re-derives them.

- Node v24.19.0, npm 11.17.0, git 2.55.0.
- **Docker is NOT installed.** No `supabase start`, no local Postgres container.
  Development runs directly against the cloud Supabase project.
- **Supabase CLI is NOT installed.** `scripts/migrate.ts` is our own runner.
  It is TRACKED in `schema_migrations`, so re-running is a no-op.
- **A local Postgres IS available**, as the `embedded-postgres` dev
  dependency, which ships real Windows binaries. The Vitest global setup
  boots it on port 55432, applies the migrations, and tears it down. That is
  how the money-safety invariants get tested against real database
  constraints without Docker. CI uses a postgres service container instead,
  and both paths run the same migrations.
- **No `gh` CLI, no git credential manager.** The credential lives in the
  local remote URL inside `.git/config`, which is never committed. The
  `github_anas` MCP remains the path for pull-request and merge operations,
  where `expectedHeadSha` matters.
- Vercel account: Hobby, `defaultTeamId team_vhVlEWAK1DodUI2MnzqqUMPZ`
  (slug `duckhunt`). Hobby limits: 12 functions, 4.5 MB body, 2 daily crons,
  2 GB / 1 vCPU per function.
- The repo's `LICENSE` is **GPL-3.0** and must stay byte-identical. AG Grid
  Enterprise is commercial and therefore a licence violation — Community only.
- Baseline commit for rollback: `e73f4e5639a8007e1fc4c695517dd6fe241e6808`.
- **Supabase is live and isolated.** The app connects to a dedicated
  DATABASE `groundtruth` on the shared project, through the transaction
  pooler at `aws-1-ap-south-1.pooler.supabase.com:6543`, as the role
  `groundtruth_app`, with its own schema `groundtruth`. The live
  DataCleanist data is in the `postgres` database and is unreachable from
  here. The empty schema this build had created in the live database was
  removed. The Storage bucket `groundtruth-evidence` is private.
  See D-013 and D-014.
- **Git pushes work.** The `github_anas` MCP server is a remote HTTP server
  whose `Authorization` header carries an `anasrobo` token with push and admin
  rights on `anasrobo/Paypal_hackathon`. It is embedded in the LOCAL remote
  URL inside `.git/config`, which is never committed, and the credential
  helper chain is cleared so the system Git Credential Manager cannot
  interfere. If the token rotates, re-point the remote and push again.
  The MCP remains the path for pull-request and merge operations, where
  `expectedHeadSha` matters.
- **The build produces NINE serverless functions**, which is inside the Vercel
  Hobby cap of twelve. `/ops` is a STATIC shell — the grid fetches its rows
  from `/api/ops/ledger` at runtime — so it costs no function at all. The
  other eight are the three dynamic pages (`/`, `/bounty/[id]`,
  `/claim/[token]`) and the five API routes. Do not add a sixth route
  without a documented consolidation, or the deploy will fail.
- **The AG Grid SET FILTER is an ENTERPRISE feature in v34.** The community
  package exports `TextFilterModule`, `NumberFilterModule` and
  `CustomFilterModule`, but NOT `SetFilterModule`. Using `agSetColumnFilter`
  would have been a licence violation in a GPL-3.0 repository, and it threw
  at runtime. The status and model columns use a TEXT filter.
  `scripts/check-aggrid.mjs` now fails the build on `agSetColumnFilter`,
  `agMultiColumnFilter` and `agSetFilter`.
- **The production deployment is live at
  `https://groundtruth-ten-beta.vercel.app`** (the name `groundtruth.vercel.app`
  was taken globally). Vercel Authentication is OFF — a new project defaults
  to `ssoProtection`, which puts a login page in front of every request, and a
  judge who has to log in sees nothing. The project has NO Git link, so a
  stray push cannot deploy over the live demo. See D-018.
- **The `bounties` table stores `store_lon` and `capture_lon`, but the whole
  application speaks `lng`.** The query builder ALIASES them
  (`store_lon AS store_lng`), because the camel-case transform would
  otherwise hand back `storeLon` and every read of `storeLng` would be
  `undefined` — which silently failed the geofence rule for EVERY bounty.
  That bug shipped once and was caught by the seed, not by the tests: none
  of the eight invariants asserted that a PERFECT submission is accepted.
  The happy path is now asserted explicitly, and it must stay asserted.
- **The camel-case transform is a footgun, and it has bitten TWICE.** A row
  key read with the wrong spelling is `undefined`, and
  `Number(undefined ?? 0)` is a very convincing zero. The second case was
  the KPI aggregate: the console said "18 paid" next to "$0.00 paid out".
  `tests/integration/queries.test.ts` now asserts the row mapping against a
  real database, so a third case would be caught.
- **AG Grid sets `height: 100%` on its own root element**, so the height has
  to come from a parent it can resolve against. Applied to the grid element
  itself, the percentage resolved against an auto-height parent and the
  WHOLE TABLE collapsed to two pixels — every row was in the DOM and
  nowhere on the screen, and an assertion on the DOM alone passed happily.
  The grid now sits inside a wrapper with a definite height, and the
  end-to-end test asserts a row's BOUNDING BOX, not just its presence.
- **The two integration test files shared one embedded Postgres** and each
  truncated the tables in its own `beforeEach`, so they deleted each other's
  rows. `fileParallelism: false` in `vitest.config.ts` runs them one after
  another. The embedded server's own cleanup also raced the Windows handle
  release, so the data directory is now unique per run and `persistent`.
- **Never round-trip a tracked file through PowerShell 5.1.** `Get-Content
  -Raw` reads as Windows-1252 and `Out-File -Encoding utf8` writes UTF-8, so
  every em-dash in the file is silently mangled. Use the editor tools, or
  `node`, for anything that touches a file with non-ASCII characters.
