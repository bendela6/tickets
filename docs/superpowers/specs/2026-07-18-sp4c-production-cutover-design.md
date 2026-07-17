# SP4c — Production Cutover Design

**Status:** approved design, ready for planning
**Branch:** `sp4c-prod-cutover` (off `main` @ `9b48215`)
**Date:** 2026-07-18

## Goal

Move the 635 live items in the production `tickets` database from the old
(pre-items) schema onto the merged items-platform schema, and deploy the merged
`main`, with **zero data loss** and a **fast rollback** — without ever letting
the importer or a container boot touch the production database destructively.

`main` is already merged (items platform + terminal/agent split landed at
`9b48215`). SP4c is therefore *only* the production data cutover + deploy. There
is no merge step.

## Context that shapes the design

- **The importer refuses to write to `tickets`.** `guard-not-production.ts`
  throws if `POSTGRES_DATABASE === 'tickets'`; `run-import.ts`, `run-verify.ts`,
  and `importLegacy()` all call it. This is deliberate (it once nearly clobbered
  prod). The cutover cannot import *into* prod — it must build the new-schema DB
  under a different name and swap. This forces the safest design anyway.
- **`entrypoint.sh` runs `db:migrate` against `tickets` on every boot.** After a
  correct blue-green swap this is a drizzle-journal no-op, but a *pre-swap*
  `docker compose up --build` would fire the new baseline against the old-schema
  `tickets` and corrupt it. **Swap must precede deploy**, and the entrypoint is
  hardened so a boot can never migrate an un-swapped prod.
- **Prod has drifted from `tickets_legacy`.** Users add items daily, so the
  stale legacy dump is not a valid source. The cutover must import from a
  **fresh dump of prod**.
- **Machinery already exists** (built + verified in SP1): `db:restore-legacy`
  (load a dump as the import source), `db:migrate` (the single new baseline),
  `db:import` (legacy→new, verified 635 items / 2948 values / 2158 events),
  `db:verify-import` (logical 0-diff oracle between source and target).
- **All databases live in one instance** — `tickets-postgres-1`
  (loopback `127.0.0.1:5532`). The prod DB is `tickets`; the cutover creates
  `tickets_new`, `tickets_old`, and a rehearsal DB `tickets_rehearsal` in the
  same instance. The single app container (`tickets-app-1`, :4610) connects to
  `tickets`.

## Locked decisions

1. **Cutover mechanism: blue-green rename.** Build the new-schema DB beside prod,
   verify 0-diff, then atomic `ALTER DATABASE` rename. Rollback = rename back.
2. **Downtime: maintenance window.** Stop the app, take the final dump, import,
   verify, swap, deploy. A few minutes of downtime guarantees no writes are lost
   between dump and swap. (Acceptable — personal app, 635 items.)
3. **Entrypoint: harden it.** Keep migrate-on-boot but add a schema-fingerprint
   guard that aborts if the target looks like the *old* schema.
4. **Outbox worker starts idle** against the freshly-imported DB — the import
   writes items/values/comments/links but no `outbox` rows, so there is **no
   historical-activity backfill**. Accepted: the activity feed begins at cutover.
5. **A full rehearsal** against a copy of real prod data is a required step
   before the live window (fits the project's "verify by measurement" rule).
6. **MCP stays broken** after cutover (SP4b skipped for now): the web app works,
   but MCP tools still call `/api/tickets/*` and `/api/ai/*`. Documented as a
   known limitation, not a surprise.

## The cutover flow (live maintenance window)

Each step names the exact command shape; the plan pins final flags.

1. **Freeze writes.** `docker compose stop app` (leaves `tickets-postgres-1` up).
   Prod `tickets` now has no writers.
2. **Fresh dump = source + backup.** `pg_dump -Fc tickets` →
   `backups/tickets-cutover-<UTC>.dump`. This one artifact is both the import
   source and the rollback backup.
3. **Restore as legacy source.** `LEGACY_DUMP=<that file> pnpm --filter
   @tickets/db db:restore-legacy` → loads it into `tickets_legacy`.
4. **Build the new DB.** Create `tickets_new`; then with
   `POSTGRES_DATABASE=tickets_new`: `db:migrate` (single new baseline) →
   `db:import` (legacy→new). Guard passes — the target is not literally
   `tickets`.
5. **Pre-flight verify (both must pass):**
   - `POSTGRES_DATABASE=tickets_new db:verify-import` reports **PASS: 0
     differences, all counts match**.
   - **No imported item event has NULL `project_id`** — the
     `events_item_project` CHECK aborts the migration/insert otherwise (verified
     0/2158 on `tickets_platform`; re-checked here on fresh prod data). A tiny
     query gates this explicitly.
6. **Swap (atomic rename, no active connections — app is stopped):**
   ```sql
   ALTER DATABASE tickets     RENAME TO tickets_old;
   ALTER DATABASE tickets_new RENAME TO tickets;
   ```
7. **Deploy.** `docker compose up -d --build app`. The hardened entrypoint sees
   the new-schema marker and runs `db:migrate` as a journal no-op, then starts
   the app (+ outbox worker + agent subsystem, idle).
8. **Smoke test.** On :4610: all 635 items visible; a project board renders; one
   item create + one status patch round-trip; the activity feed appends.

## Entrypoint hardening

`docker/entrypoint.sh` gains a **schema-fingerprint pre-check** before
`db:migrate`. It inspects the target DB (`POSTGRES_DATABASE`, i.e. `tickets` in
the deployed env) for marker tables:

- **New-schema marker present** (e.g. `item_values`) → proceed; migrate is a
  safe no-op.
- **Database empty** (neither marker) → proceed; fresh migrate.
- **Old-schema marker present** (e.g. `statuses`) **and new absent** → **abort**
  with a non-zero exit and:
  `refusing to migrate: target "$POSTGRES_DATABASE" looks like the OLD
  (pre-items) schema — run the SP4c cutover swap before deploying.`

The check is a single `psql`/`information_schema` query (exact marker table
names pinned in the plan against `read-legacy.ts` for the old side and
`packages/db/src/schema/` for the new side). This makes it impossible for a
container boot to fire the new baseline at an un-swapped prod.

## Rehearsal (required, before the live window)

Run the entire flow end-to-end against a **copy of real prod data** in a scratch
DB, changing nothing in prod:

1. `pg_dump` prod `tickets` → rehearsal dump (read-only on prod).
2. Restore into `tickets_legacy`; `db:migrate` + `db:import` into
   `tickets_rehearsal`; `db:verify-import` → must be 0-diff.
3. Run the NULL-`project_id` pre-flight query → must be 0.
4. Point a throwaway app instance (or the test/dev config) at
   `tickets_rehearsal` and smoke-test the board + a mutation.
5. Exercise the entrypoint guard's three branches against seeded schemas.

The rehearsal proves the exact commands and the fresh prod data before any
downtime. Only after a clean rehearsal is the live window scheduled.

## Rollback

- **Before step 6 (swap):** free — prod is still `tickets`, untouched.
  `docker compose start app` and investigate.
- **After step 6, before/after deploy:** reverse the rename and redeploy the
  previous image:
  ```sql
  ALTER DATABASE tickets     RENAME TO tickets_new;   -- (or drop it)
  ALTER DATABASE tickets_old RENAME TO tickets;
  ```
  then `docker compose up -d app` on the prior build. `tickets_old` is retained
  until the cutover is confirmed healthy and explicitly dropped — it is the
  point-in-time backup of the old schema.

## Components & files

- `docker/entrypoint.sh` — add the schema-fingerprint guard before `db:migrate`.
- `packages/db/src/import/preflight-null-project.ts` (new) — the
  NULL-`project_id` gate as a small script (`db:preflight-cutover`), reused by
  rehearsal and the live window.
- `scripts/cutover.sh` (new) — the orchestrated runbook (freeze → dump → restore
  → migrate → import → verify → preflight → swap → deploy → smoke), with a
  `--rehearsal` mode that targets `tickets_rehearsal` and skips the freeze/swap.
- `docs/runbooks/sp4c-cutover.md` (new) — the human runbook: exact commands, the
  go/no-go checklist, and the rollback steps.
- Tests: entrypoint guard (three branches), the preflight script, and the
  rehearsal is itself the integration proof.

## Testing strategy

- **Unit:** entrypoint fingerprint guard (old-schema → abort, new-schema →
  proceed, empty → proceed); preflight NULL-`project_id` query (0 → pass, planted
  NULL → fail).
- **Integration (rehearsal):** the full flow against a copy of prod data;
  `db:verify-import` is the correctness oracle (0-diff or the cutover is a
  no-go).
- **Smoke (post-deploy):** board renders 635 items, a create + a status patch
  round-trip, activity feed appends.

## Out of scope

- MCP port (SP4b) — MCP tools remain runtime-broken after cutover.
- Any schema change — SP4c ships the schema already on `main`.
- Moving the 22 items tables out of `public` into core/structure/records/history
  (a separate later Plan 2).

## Types / glossary

- **`tickets`** — the live production database (old schema before cutover, new
  schema after).
- **`tickets_old`** — post-swap name of the pre-cutover production DB (retained
  backup).
- **`tickets_new`** — the freshly built new-schema DB before it is renamed to
  `tickets`.
- **`tickets_legacy`** — the import *source*: a restore of a prod dump, read by
  `read-legacy.ts`.
- **`tickets_rehearsal`** — scratch DB for the pre-window rehearsal.
- **New-schema marker** — a table that exists only in the items schema (e.g.
  `item_values`).
- **Old-schema marker** — a table that exists only in the pre-items schema (e.g.
  `statuses`).
- **0-diff** — `db:verify-import` reporting `PASS: 0 differences, all counts
  match`.
