<!-- GROUNDTRUTH:BUILD_STATE:BEGIN -->
phase: 1
status: COMPLETE
task: T2-01
last_test: 63 passed / 0 failed
attempts: 0
commit: 50f64b0282723988e125daf83b77d543879e49b8
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
| P2 Server core | NOT_STARTED | — | — | needs `DATABASE_URL` |
| P3 Route handlers | NOT_STARTED | — | — | |
| P4 Screens + AG Grid | NOT_STARTED | — | — | |
| P5 Seed + E2E | NOT_STARTED | — | — | |
| P6 Deploy | NOT_STARTED | — | — | blocked on Supabase project |
| P7 Submission | NOT_STARTED | — | — | |

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
- **No `gh` CLI, no git credential manager.** `git push` cannot authenticate.
  All GitHub writes go through the `github_anas` MCP (identity `anasrobo`).
  The local clone is a development workspace only.
- Vercel account: Hobby, `defaultTeamId team_vhVlEWAK1DodUI2MnzqqUMPZ`
  (slug `duckhunt`). Hobby limits: 12 functions, 4.5 MB body, 2 daily crons,
  2 GB / 1 vCPU per function.
- The repo's `LICENSE` is **GPL-3.0** and must stay byte-identical. AG Grid
  Enterprise is commercial and therefore a licence violation — Community only.
- Baseline commit for rollback: `e73f4e5639a8007e1fc4c695517dd6fe241e6808`.
- **Git pushes work.** The `github_anas` MCP server is a remote HTTP server
  whose `Authorization` header carries an `anasrobo` token with push and admin
  rights on `anasrobo/Paypal_hackathon`. It is embedded in the LOCAL remote
  URL inside `.git/config`, which is never committed, and the credential
  helper chain is cleared so the system Git Credential Manager cannot
  interfere. If the token rotates, re-point the remote and push again.
  The MCP remains the path for pull-request and merge operations, where
  `expectedHeadSha` matters.
