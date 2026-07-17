# Runbook — SP4c Production Cutover

Moves prod `tickets` (635 items) onto the items-platform schema by a blue-green
rename. All databases live in the `tickets-postgres-1` container. The importer
refuses a DB named `tickets`, so we build `tickets_new` and swap.

## Preconditions
- On `main`, image builds from the merged tree (`9b48215` or later).
- `docker compose ps` shows `postgres` and `app` up.
- A quiet moment: the swap needs a short maintenance window.

## 1. Rehearse first (no downtime, no prod writes)
    bash scripts/cutover.sh --rehearsal
Expected: `db:verify-import` prints `PASS: 0 differences, all counts match`, and
the preflight prints `NULL project_id = 0`. If either fails — STOP, do not run
the live window; the mapping or data has an issue.

Optionally smoke-test the rehearsal DB by pointing a throwaway app at
`POSTGRES_DATABASE=tickets_rehearsal`.

## 2. Go / No-Go
Proceed to the live window ONLY if the rehearsal was 0-diff and preflight 0.

## 3. Live window
    bash scripts/cutover.sh
This freezes the app, dumps prod, builds + verifies `tickets_new`, then PROMPTS
before the swap. Confirm `PASS: 0 differences` in the output, then type `swap`.
It renames `tickets -> tickets_old`, `tickets_new -> tickets`, and deploys.

## 4. Smoke test (:4610)
- All 635 items visible; a project board renders.
- Create one item + change one status — both round-trip.
- Activity feed appends (it starts empty — no historical backfill).

## 5. Rollback
Before the swap: `docker compose start app` — prod (`tickets`) is untouched.

After the swap:
    docker exec tickets-postgres-1 psql -U postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE tickets RENAME TO tickets_new;"
    docker exec tickets-postgres-1 psql -U postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE tickets_old RENAME TO tickets;"
then redeploy the prior image. `tickets_old` is the point-in-time backup; keep it
until the cutover is confirmed healthy, then:
    docker exec tickets-postgres-1 psql -U postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE tickets_old;"

## Known limitation
MCP tools remain runtime-broken after cutover (SP4b not yet done) — they still
call `/api/tickets/*` and `/api/ai/*`. The web app is fully functional.
