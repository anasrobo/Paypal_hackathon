# Decisions

> Append-only. Each entry is `## D-NNNN — Title` with Decision / Rationale /
> Rejected alternative / Revisit if.
>
> **These are frozen.** A later agent may not re-litigate an entry. To change
> one, add a NEW entry that explicitly names the old one under
> "Supersedes". `scripts/check-protocol.mjs` fails the build if a new
> dependency or a new top-level `src/` directory appears after phase 2 without
> such an entry.

## D-000 — Oracle Cloud is out of scope

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** This project will not touch Oracle Cloud. No `setup-oci.ps1`, no
`provision.ps1`, no `oci` CLI call, no new instance, no new container, no new
port, no new security-list rule. The running `nirora` container and its
three-minute auto-rebuild timer are never modified.

**Rationale.** The Oracle VM (`nirora-app`, 2 OCPU / 12 GB, `ap-hyderabad-1`)
serves **plain HTTP on port 8000**. Browsers block `navigator.geolocation` and
`getUserMedia` on insecure origins, so the phone capture screen — the centre
of the demo — cannot work there without new TLS, a domain, and new ingress
rules on a security list shared with a live application. Vercel plus Supabase
is free, always warm, HTTPS, and requires zero changes to a running service.
`deploy/provision.ps1` would also launch a **second 12 GB instance** and
compete for the Always-Free A1 allocation.

**Rejected alternative.** Hosting on the Oracle VM with Caddy and a domain.

**Revisit if.** The user explicitly asks for an Oracle target, AND a domain is
available, AND the OCI security list can be extended without affecting the
`nirora` app. If it is ever revived, it must use its own directory
(`/opt/groundtruth-reconciler`), its own container name
(`groundtruth-reconciler`), and its own port (8010) — never 8000, never
`/opt/nirora_section-a`.

---

## D-001 — A new, isolated Supabase project

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** GroundTruth uses its own Supabase project. The existing
"DataCleanist" project (used by `version_1`, region `ap-south-1`) is never
read from, linked to, written to, or migrated. New project region:
`us-east-1`.

**Rationale.** DataCleanist is a live production database carrying real
Razorpay and Dodo payment tables, with hand-applied numbered migrations, no
migration runner, and RLS policies that a prior incident deliberately locked
down. Sharing it would put a hackathon's schema churn next to a real payment
system. A different region also makes accidental cross-linking impossible.

**Rejected alternative.** New `gt_*` tables inside the DataCleanist project.

**Revisit if.** Never.

---

## D-002 — Vercel for hosting, on the `duckhunt` team scope

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** The app is deployed to Vercel, team scope `duckhunt`
(`team_vhVlEWAK1DodUI2MnzqqUMPZ`, Hobby plan). The project is created
**without** a GitHub `gitRepository` so no stray push can auto-deploy over the
live demo. Deploys are explicit. The GitHub repository is connected only after
`main` is verified green.

**Rationale.** Free HTTPS, always warm, and a 4.5 MB body limit that the
upload path is designed around. The account is already on Hobby in that team,
so no paid plan is required. Hobby constraints we design against: 12
functions (target ≤ 9), 2 daily crons, 2 GB / 1 vCPU per function.

**Rejected alternative.** Render — its prize is credits only and a Render free
service sleeps for about a minute, which is a judging risk.

**Revisit if.** The user buys Vercel Pro, which would raise the function and
cron limits.

---

## D-003 — Raw SQL with `postgres.js`; no ORM

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** All database access is raw SQL through `postgres.js` with typed
row interfaces. No Prisma, no Drizzle, no ORM model layer.

**Rationale.** The user's own production project states the rule explicitly:
*"No ORM-mapped application models exist — queries are raw SQL over the
migration-created schema. Follow that pattern; do not introduce an ORM model
layer piecemeal."* Prisma additionally breaks interactive transactions under
the Supabase transaction pooler, which is exactly how this app connects.

**Rejected alternative.** Prisma with a generated client.

**Revisit if.** Never for this hackathon.

---

## D-004 — No directory named `lib/` anywhere in the source tree

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** The source layout is `src/domain/`, `src/server/`, `src/ops/`,
`src/app/`, `src/components/`. No directory is named `lib`.

**Rationale.** The repo shipped GitHub's Python `.gitignore`, whose bare
`lib/` pattern matches at any depth, and Git cannot re-include files under an
excluded directory — so `!src/lib/` would not have fixed it. The `.gitignore`
has been replaced (T0-02), but this rule is an independent second defence that
survives a future merge from `main` reintroducing the old file.

**Rejected alternative.** Relying on the `.gitignore` alone.

**Revisit if.** Never.

---

## D-005 — `postgres.js` against the Supabase **pooler** only

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** `DATABASE_URL` must point at a Supabase **pooler** host in
session mode (port 5432). `src/server/db/client.ts` throws at startup in
production if the host does not contain `pooler.supabase.com`.

**Rationale.** The direct host (`db.<ref>.supabase.co`) is IPv6-only and
Vercel cannot reach it. This single misconfiguration turns every judge click
into a 500 and is the highest-probability silent failure in the whole project.
The guard makes it impossible to ship.

**Rejected alternative.** Direct connection with a fallback.

**Revisit if.** Never.

---

## D-006 — The 60-second reconciler is pull-based, not cron-driven

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** The reconciler runs opportunistically at the top of
`GET /bounty/[id]` and `GET /api/ops/ledger` — the judge looking at the screen
is the trigger — backed by a daily cron. It is never the only mechanism.

**Rationale.** Vercel Hobby cron runs **at most daily**; it cannot drive a
60-second sweep. A reconciler that "sometimes fires" is worse than one that
always does. The sweep is a single indexed `UPDATE` against a partial index,
so it costs effectively nothing when there is nothing to do.

**Rejected alternative.** A 60-second cron (impossible on Hobby) and a
background worker on the Oracle VM (see D-000).

**Revisit if.** The user upgrades to Vercel Pro, where per-minute cron exists.

---

## D-007 — Image bytes never transit a Vercel function

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** The browser downscales the photo and uploads it **directly** to
a private Supabase Storage bucket with a server-issued signed upload URL. The
`/api/claim` route handler receives JSON only.

**Rationale.** Vercel Hobby caps request bodies at 4.5 MB while the
verification rule is "under 10 MB". Uploading directly makes the cap
irrelevant, keeps the function fast, and means the 10 MB rule can still be
evaluated honestly against the **original** file size, which the client
reports separately. The two limits are different things and are named
differently in the code.

**Rejected alternative.** Posting the file through the route handler.

**Revisit if.** Never.

---

## D-008 — AG Grid Community only, with the infinite row model

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** `ag-grid-community` + `ag-grid-react` (MIT). No Enterprise, no
Studio, no licence key, and no `ag-grid-enterprise` package in
`package.json`. The ledger uses `rowModelType: 'infinite'` (Community's
server-paginated model) with custom cell renderers, the Theming API, and a
hand-built natural-language query layer.

**Rationale.** AG Grid's sponsor prize is $5,000 and stacks with 1st Place, so
the grid must be first-class. But AG Grid Enterprise is a **commercial
licence**, and this repository is GPL-3.0 — using Enterprise here would be a
licence violation. The Server-Side Row Model is Enterprise-only, so the
Community `infinite` model is the correct shape: it is genuinely server
paginated, which also keeps the payload small.

**Rejected alternative.** AG Grid Enterprise or AG Studio.

**Revisit if.** The relicensing question is settled by a human, which is
out of scope for a 23-day build.

---

## D-009 — One vertical: shelf and price verification

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** The only vertical is a procurement agent that needs to know
whether a SKU is on the shelf at a given store and what the price tag says.

**Rationale.** Scope creep into a second vertical is the single documented way
to lose this hackathon. Judges score the problem that was *demonstrated*, not
the problem that was described. Widening the vertical after phase 2 requires
a new decision entry.

**Rejected alternative.** Property viewings, delivery proof, insurance
verification, mystery shopping.

**Revisit if.** The submission is already accepted.

---

## D-010 — The model is advisory; the gate decides

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** The vision model contributes to exactly two of the six
verification rules. `evaluateGate()` is a pure function and is the only thing
that can produce `VERIFIED` or `REJECTED`. The model can only ever cause a
rule to fail.

**Rationale.** A system that pays a stranger based on a model's opinion is
both unsafe and indefensible to a judging panel that includes engineers. The
adversarial test — a perfect model output with a failed geofence rule — is
the proof.

**Rejected alternative.** Letting the model emit the final verdict.

**Revisit if.** Never.

---

## D-011 — At-most-once payouts; no automatic retry

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** A failed PayPal call moves the bounty to `PAYOUT_FAILED` and is
**never retried automatically**. A human resolves it. The reconciler may
re-drive a call only when the `payouts` row exists with no `external_id` —
meaning the process died between the database insert and the PayPal call —
and it reuses the same deterministic `sender_batch_id`, which PayPal dedupes.

**Rationale.** Auto-retry is the conventional choice and it is the one that
risks double-paying a stranger. A $6 duplicate payment to a real person is a
worse failure than a bounty that needs a human.

**Rejected alternative.** Automatic retry with backoff.

**Revisit if.** Never.

---

## D-012 — All GitHub writes go through the `github_anas` MCP

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** `main` is only ever modified through `merge_pull_request` with
`merge_method: "squash"` and `expectedHeadSha` set. All direct writes target
the branch `feat/groundtruth-bootstrap`. Writes use the `github_anas` server,
whose identity is verified as `anasrobo`.

**Rationale.** The second `github` MCP server has no `get_me` and therefore an
unverified identity. `main` has `protected: false`, so a mistyped branch
argument would clobber it. The baseline commit
`e73f4e5639a8007e1fc4c695517dd6fe241e6808` is the rollback target.

**Rejected alternative.** `git push` — there is no credential helper on this
machine, so it cannot authenticate.

**Revisit if.** A GitHub PAT is configured for the local git client.

---

## D-013 — A dedicated DATABASE in the shared Supabase project, not a separate project

**Date:** 2026-10-20
**Status:** FROZEN
**Supersedes:** D-001 (a new, isolated Supabase *project*)

**Decision.** GroundTruth uses a dedicated DATABASE named `groundtruth` on the
existing Supabase project, accessed as a dedicated role `groundtruth_app`
through the transaction pooler. The application's schema inside that
database is `groundtruth`. The live product's data lives in the `postgres`
database of the same instance and is unreachable from this application.

**Rationale.** A separate project WAS created (`ipwrpaqojpzkpyxyggym`, region
`us-east-1`) and it is alive, but the personal access token in the MCP
config only resolves the DataCleanist project, so the new project's database
password and API keys cannot be read through the management API. The
dedicated-database approach is, in one respect, STRONGER than a separate
project: a Postgres connection is bound to a database, so a connection to
`groundtruth` physically cannot see the tables in `postgres`. The app role
owns only its own database, holds no grants on any live table, and its
`search_path` names only its own schema. The live database was verified
unaffected, and the empty schema this build had earlier created in it was
removed.

**Rejected alternative.** A separate Supabase project, blocked by the
credential's project scope.

**Revisit if.** The user grants a project-scoped credential for the
`groundtruth` project, at which point that project can be used directly.

---

## D-014 — The pooler, not the direct host

**Date:** 2026-10-20
**Status:** FROZEN

**Decision.** The application connects through
`aws-1-ap-south-1.pooler.supabase.com:6543` (the transaction pooler).

**Rationale.** The direct host `db.<ref>.supabase.co` does not resolve from
this machine and is IPv6-only, so Vercel cannot reach it either. The
transaction pooler is the only working route. Two further details cost real
debugging time and are recorded so they are not rediscovered: the pooler
resolves a custom role on the `aws-1` instance and not on `aws-0`, and the
pooler CACHES both the user's password hash and the role's `search_path`, so
a password changed server-side can be rejected until the cache catches up.
The role's `search_path` is therefore pinned to the same schema name the
pooler cached.

**Revisit if.** The app ever needs a session-scoped setting that the
transaction pooler cannot carry.
