# SP4c Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tooling + runbook to move prod `tickets` (635 items) from the old schema onto the items-platform schema via a blue-green rename, and deploy — with zero data loss and a fast rollback.

**Architecture:** A small cross-platform schema-guard (a pure classifier + a CLI the container entrypoint calls) prevents a boot from ever migrating an un-swapped old-schema prod. A single orchestration script (`scripts/cutover.sh`) drives the maintenance-window sequence using the existing SP1 import machinery (`db:restore-legacy` / `db:migrate` / `db:import` / `db:verify-import`), with a `--rehearsal` mode against a scratch DB and a `--dry-run` mode that only prints. A human runbook captures the go/no-go and rollback.

**Tech Stack:** TypeScript (tsx) + postgres-js + drizzle in `@tickets/db`; POSIX `sh` entrypoint; Bash orchestration script; Docker Compose (`postgres` + `app` services); vitest.

## Global Constraints

- **SDD builds Tasks 1–4 only (the tooling + runbook). The rehearsal and the live cutover are HUMAN-EXECUTED under an explicit go — never run by an autonomous subagent.** They dump/rename real databases and touch production. See "Manual execution" at the end; no SDD task performs a dump, restore, `db:import`, `ALTER DATABASE`, or deploy.
- **Never point the importer/verifier at a database literally named `tickets`.** `assertNotProductionDatabase()` throws by design (`packages/db/src/import/guard-not-production.ts`). Blue-green builds `tickets_new`; the importer only ever sees `tickets_new` / `tickets_rehearsal`.
- **Old-schema marker table: `statuses`. New-schema marker table: `item_values`.** These are the fingerprint the schema-guard keys on (each exists in exactly one of the two schemas).
- **Compose services are `postgres` and `app`;** the postgres container is `tickets-postgres-1` (all DBs live in this one instance, loopback `127.0.0.1:5532`). Freeze = `docker compose stop app`; deploy = `docker compose up -d --build app`.
- **Swap must precede deploy.** A pre-swap `docker compose up --build` would fire the new baseline at old-schema `tickets`; the entrypoint guard makes that abort.
- **0-diff from `db:verify-import` (`PASS: 0 differences, all counts match`) is the go/no-go oracle.** No swap without it.
- **`tickets_old` is retained** after swap as the point-in-time backup until the cutover is confirmed healthy and explicitly dropped.
- **Outbox worker starts idle; no historical-activity backfill.** The activity feed begins at cutover.
- **MCP stays runtime-broken** (SP4b skipped) — a documented known limitation, not part of this plan.
- Work directly on `main` in the primary worktree `C:\Users\bbend\Desktop\Projects\tickets`. One commit per task.

---

## File Structure

- `packages/db/src/schema-classify.ts` (new) — pure `classifySchema(tables) → 'new'|'old'|'empty'`. No DB import, unit-tested in isolation.
- `packages/db/src/schema-classify.test.ts` (new) — the classifier's table.
- `packages/db/src/schema-guard.ts` (new) — CLI: queries the target DB's table names, classifies, exits non-zero with a clear message on `old`, else prints and exits 0.
- `packages/db/package.json` (modify) — add `db:check-schema` script.
- `docker/entrypoint.sh` (modify) — call `db:check-schema` before `db:migrate`.
- `scripts/cutover.sh` (new) — the maintenance-window orchestration (`--rehearsal`, `--dry-run`).
- `docs/runbooks/sp4c-cutover.md` (new) — the human runbook: go/no-go checklist, exact commands, rollback.

Note (deviation from spec, YAGNI): the spec listed a standalone `preflight-null-project.ts` + `db:preflight-cutover`. A single count query needs no tsx entry point — it is folded into `cutover.sh` as a `psql` assertion. The `events_item_project` CHECK already makes a violating import *fail at insert* (before any swap); the assertion is the explicit, human-readable confirmation of that.

---

## Task 1: Schema guard (classifier + CLI + script)

**Files:**
- Create: `packages/db/src/schema-classify.ts`
- Create: `packages/db/src/schema-classify.test.ts`
- Create: `packages/db/src/schema-guard.ts`
- Modify: `packages/db/package.json`

**Interfaces:**
- Produces: `classifySchema(tables: Iterable<string>): SchemaKind` where `type SchemaKind = 'new' | 'old' | 'empty'`.
- Produces: the `db:check-schema` npm script — exits `0` for `new`/`empty`, `1` for `old`, reading the DB named by `POSTGRES_DATABASE` (default `tickets`). Called by `docker/entrypoint.sh` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema-classify.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifySchema } from './schema-classify';

describe('classifySchema', () => {
  it('classifies the items schema by its item_values marker', () => {
    expect(classifySchema(['items', 'item_values', 'users', 'projects'])).toBe('new');
  });
  it('classifies the pre-items schema by its statuses marker', () => {
    expect(classifySchema(['tickets', 'statuses', 'ticket_values', 'users'])).toBe('old');
  });
  it('classifies a database with neither marker as empty', () => {
    expect(classifySchema([])).toBe('empty');
    expect(classifySchema(['users', 'projects'])).toBe('empty');
  });
  it('prefers new when (defensively) both markers are present', () => {
    expect(classifySchema(['item_values', 'statuses'])).toBe('new');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/db exec vitest run src/schema-classify.test.ts`
Expected: FAIL — `Cannot find module './schema-classify'`.

- [ ] **Step 3: Write the classifier**

Create `packages/db/src/schema-classify.ts`:

```ts
// Fingerprint a database as the new items schema, the old pre-items schema, or
// empty, by two marker tables that each exist in exactly one schema:
//   item_values -> items platform;  statuses -> pre-items ticket schema.
export type SchemaKind = 'new' | 'old' | 'empty';

export function classifySchema(tables: Iterable<string>): SchemaKind {
  const set = new Set(tables);
  if (set.has('item_values')) return 'new';
  if (set.has('statuses')) return 'old';
  return 'empty';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/db exec vitest run src/schema-classify.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the CLI**

Create `packages/db/src/schema-guard.ts`:

```ts
// Called by docker/entrypoint.sh before db:migrate. Reads the target database
// (POSTGRES_DATABASE) and refuses to proceed if it looks like the OLD schema —
// so a container boot can never fire the new baseline at an un-swapped prod.
// Read-only and deliberately NOT behind assertNotProductionDatabase: inspecting
// `tickets` is exactly what we want here.
import { createDbClient } from './client';
import { environment } from './environment';
import { classifySchema } from './schema-classify';

const { sql } = createDbClient({ max: 1 });
const rows = await sql<{ table_name: string }[]>`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
`;
await sql.end();

const target = environment.postgres.database;
const kind = classifySchema(rows.map((r) => r.table_name));

if (kind === 'old') {
  console.error(
    `schema-guard: refusing to migrate — target "${target}" looks like the OLD ` +
      '(pre-items) schema. Run the SP4c cutover swap before deploying ' +
      '(see docs/runbooks/sp4c-cutover.md).',
  );
  process.exit(1);
}
console.log(`schema-guard: target "${target}" is ${kind}; proceeding with db:migrate.`);
```

- [ ] **Step 6: Add the npm script**

In `packages/db/package.json` `scripts`, add after `db:migrate`:

```json
    "db:check-schema": "tsx src/schema-guard.ts",
```

- [ ] **Step 7: Verify the CLI against the (new-schema) test DB**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/db db:check-schema`
Expected: prints `schema-guard: target "tickets_test" is new; proceeding with db:migrate.` and exits 0.
(The `old` and `empty` branches are covered by the Task 1 unit test; this proves the wiring + query against a real DB.)

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/schema-classify.ts packages/db/src/schema-classify.test.ts packages/db/src/schema-guard.ts packages/db/package.json
git commit -m "feat(db): schema-guard — refuse db:migrate against an old-schema target"
```

---

## Task 2: Harden the container entrypoint

**Files:**
- Modify: `docker/entrypoint.sh`

**Interfaces:**
- Consumes: the `db:check-schema` script from Task 1.

- [ ] **Step 1: Add the guard before migrate**

Replace the body of `docker/entrypoint.sh` with:

```sh
#!/bin/sh
set -e

# SP4c cutover guard: refuse to migrate an un-swapped OLD-schema production DB.
# Exits non-zero (aborting the boot via `set -e`) if POSTGRES_DATABASE still
# holds the pre-items schema. See docs/runbooks/sp4c-cutover.md.
pnpm --filter @tickets/db db:check-schema

# migrate the prod database (POSTGRES_DATABASE=tickets in the deployed env)
pnpm --filter @tickets/db db:migrate

# hand off to the process supervisor
exec supervisord -c /etc/supervisor/conf.d/tickets.conf
```

- [ ] **Step 2: Verify it is valid POSIX sh**

Run: `sh -n docker/entrypoint.sh`
Expected: no output, exit 0 (syntax OK).

- [ ] **Step 3: Verify the guard command resolves the same way `db:migrate` does**

Confirm the new line uses the identical `pnpm --filter @tickets/db` invocation already proven to work for `db:migrate` in this file (so it runs in the same container context). No new tooling is introduced.

- [ ] **Step 4: Commit**

```bash
git add docker/entrypoint.sh
git commit -m "feat(deploy): entrypoint refuses to migrate an un-swapped old-schema prod"
```

---

## Task 3: Cutover orchestration script

**Files:**
- Create: `scripts/cutover.sh`

**Interfaces:**
- Consumes: existing scripts `db:restore-legacy`, `db:migrate`, `db:import`, `db:verify-import` (all in `packages/db/package.json`); the `postgres` container `tickets-postgres-1`.
- Produces: `scripts/cutover.sh [--rehearsal] [--dry-run]`. Default = live window (freeze → dump → restore → migrate → import → verify → preflight → swap → deploy → smoke prompt). `--rehearsal` targets `tickets_rehearsal` and skips the freeze and the swap. `--dry-run` prints every command instead of running it.

- [ ] **Step 1: Write the script**

Create `scripts/cutover.sh`:

```bash
#!/usr/bin/env bash
# SP4c production cutover — blue-green rename. See docs/runbooks/sp4c-cutover.md.
# Modes:
#   (default)     live maintenance window: freeze app, dump prod, build+verify
#                 tickets_new, swap, deploy. IRREVERSIBLE past the swap.
#   --rehearsal   build+verify tickets_rehearsal from a fresh prod dump; NO
#                 freeze, NO swap, NO deploy. Safe to run anytime.
#   --dry-run     print each command instead of executing it.
set -euo pipefail

PG=tickets-postgres-1                 # postgres container (all DBs live here)
PROD=tickets                          # live production database
REHEARSAL_DB=tickets_rehearsal
BACKUP_DIR="backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="${BACKUP_DIR}/tickets-cutover-${STAMP}.dump"

MODE="live"; DRY=0
for arg in "$@"; do
  case "$arg" in
    --rehearsal) MODE="rehearsal" ;;
    --dry-run)   DRY=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

if [ "$MODE" = "rehearsal" ]; then TARGET="$REHEARSAL_DB"; else TARGET=tickets_new; fi

run() {  # echo, then run (or just echo under --dry-run)
  echo "+ $*"
  if [ "$DRY" -eq 0 ]; then eval "$@"; fi
}
psql_prod() {  # run one SQL statement in the prod postgres container (no eval)
  echo "+ docker exec $PG psql -U postgres -v ON_ERROR_STOP=1 -c \"$1\""
  if [ "$DRY" -eq 0 ]; then
    docker exec "$PG" psql -U postgres -v ON_ERROR_STOP=1 -c "$1"
  fi
}

echo "== SP4c cutover (mode=$MODE dry-run=$DRY) =="

# 1. Freeze (live only)
if [ "$MODE" = "live" ]; then
  run "docker compose stop app"
fi

# 2. Fresh dump of prod (read-only) — source + backup
run "mkdir -p $BACKUP_DIR"
run "docker exec $PG pg_dump -U postgres -Fc $PROD > $DUMP"

# 3. Restore the dump as the import source (tickets_legacy)
run "LEGACY_DUMP=$DUMP pnpm --filter @tickets/db db:restore-legacy"

# 4. Build the target DB (drop+create, migrate, import) — never named 'tickets'
psql_prod "DROP DATABASE IF EXISTS $TARGET;"
psql_prod "CREATE DATABASE $TARGET;"
run "POSTGRES_DATABASE=$TARGET pnpm --filter @tickets/db db:migrate"
run "POSTGRES_DATABASE=$TARGET pnpm --filter @tickets/db db:import"

# 5. Verify: 0-diff oracle + NULL project_id preflight (both must pass)
run "POSTGRES_DATABASE=$TARGET pnpm --filter @tickets/db db:verify-import"
if [ "$DRY" -eq 0 ]; then
  NULLS="$(docker exec $PG psql -U postgres -tAc \
    "SELECT count(*) FROM events WHERE aggregate_type='item' AND project_id IS NULL" $TARGET)"
else
  NULLS="0"
fi
echo "preflight: item events with NULL project_id = ${NULLS:-?}"
if [ "$DRY" -eq 0 ] && [ "${NULLS:-1}" != "0" ]; then
  echo "ABORT: item events with NULL project_id — the events_item_project CHECK would fail." >&2
  exit 1
fi

if [ "$MODE" = "rehearsal" ]; then
  echo "== rehearsal complete: $TARGET built + verified. No swap, no deploy. =="
  echo "   Smoke-test it by pointing a throwaway app at POSTGRES_DATABASE=$TARGET."
  exit 0
fi

# 6. Swap (live only) — atomic rename; app is stopped so no active connections
echo "== GO/NO-GO: verify-import must have printed 'PASS: 0 differences'. =="
if [ "$DRY" -eq 0 ]; then
  read -r -p "Type 'swap' to rename ${PROD}->tickets_old and tickets_new->${PROD}: " ok
  [ "$ok" = "swap" ] || { echo "aborted before swap; prod untouched."; exit 1; }
else
  echo "+ [dry-run] would prompt to confirm the swap here"
fi
psql_prod "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$PROD' AND pid <> pg_backend_pid();"
psql_prod "ALTER DATABASE $PROD RENAME TO tickets_old;"
psql_prod "ALTER DATABASE tickets_new RENAME TO $PROD;"

# 7. Deploy — entrypoint guard sees the new schema; db:migrate is a no-op
run "docker compose up -d --build app"

echo "== swap + deploy done. Smoke-test :4610 (635 items, board, create+patch). =="
echo "   Rollback: ALTER DATABASE $PROD RENAME TO tickets_new; ALTER DATABASE tickets_old RENAME TO $PROD; redeploy prior image."
echo "   tickets_old is retained as the backup until you drop it explicitly."
```

- [ ] **Step 2: Verify it is valid Bash**

Run: `bash -n scripts/cutover.sh`
Expected: no output, exit 0.

- [ ] **Step 3: Verify the dry-run rehearsal prints the expected sequence without touching anything**

Run: `bash scripts/cutover.sh --rehearsal --dry-run`
Expected: prints `+ ...` lines for dump, `db:restore-legacy`, DROP/CREATE `tickets_rehearsal`, `db:migrate`, `db:import`, `db:verify-import`, the preflight query — and **no** `docker compose stop app` line and **no** `ALTER DATABASE` line. Exits 0.

- [ ] **Step 4: Verify the dry-run live mode includes freeze + swap + deploy**

Run: `bash scripts/cutover.sh --dry-run`
Expected: prints `+ docker compose stop app` first, and includes the swap prompt + `+ docker compose up -d --build app`. (It will stop at the interactive `read` if run without input — that is expected; Ctrl-C is fine. The point is the sequence is present in the echoed plan before the prompt.)

- [ ] **Step 5: Make it executable and commit**

```bash
git update-index --chmod=+x scripts/cutover.sh 2>/dev/null || chmod +x scripts/cutover.sh
git add scripts/cutover.sh
git commit -m "feat(deploy): scripts/cutover.sh — blue-green prod cutover (+ rehearsal, dry-run)"
```

---

## Task 4: Human runbook

**Files:**
- Create: `docs/runbooks/sp4c-cutover.md`

**Interfaces:**
- Consumes: `scripts/cutover.sh` (Task 3), the schema-guard (Task 1), the entrypoint guard (Task 2).

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/sp4c-cutover.md`:

```markdown
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
    docker exec tickets-postgres-1 psql -U postgres -c "ALTER DATABASE tickets RENAME TO tickets_new;"
    docker exec tickets-postgres-1 psql -U postgres -c "ALTER DATABASE tickets_old RENAME TO tickets;"
then redeploy the prior image. `tickets_old` is the point-in-time backup; keep it
until the cutover is confirmed healthy, then:
    docker exec tickets-postgres-1 psql -U postgres -c "DROP DATABASE tickets_old;"

## Known limitation
MCP tools remain runtime-broken after cutover (SP4b not yet done) — they still
call `/api/tickets/*` and `/api/ai/*`. The web app is fully functional.
```

- [ ] **Step 2: Verify the runbook references match the script**

Confirm the commands in the runbook (`bash scripts/cutover.sh --rehearsal`, `bash scripts/cutover.sh`, the two rollback `ALTER DATABASE` statements, `DROP DATABASE tickets_old`) exactly match Task 3's script behavior and Global Constraints. Fix any drift.

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/sp4c-cutover.md
git commit -m "docs(sp4c): production cutover runbook (rehearsal, go/no-go, rollback)"
```

---

## Manual execution (NOT an SDD task — human-run, gated)

After Tasks 1–4 land and `pnpm typecheck` + `pnpm --filter @tickets/db test` are green, the cutover itself is executed by a human following `docs/runbooks/sp4c-cutover.md`:

1. **Rehearsal:** `bash scripts/cutover.sh --rehearsal` → require `PASS: 0 differences` and preflight `0`. Optionally smoke-test `tickets_rehearsal`.
2. **Go/No-Go** on the rehearsal result.
3. **Live window:** `bash scripts/cutover.sh` → confirm 0-diff, type `swap`, deploy.
4. **Smoke test** :4610; keep `tickets_old` until healthy, then drop it.

No autonomous agent performs steps 1–4. They dump/rename real databases and deploy to production.

---

## Self-Review

**Spec coverage:**
- Blue-green rename → Task 3 (`cutover.sh` build `tickets_new` + `ALTER DATABASE`). ✅
- Maintenance window (freeze/swap/deploy) → Task 3 live mode + Task 4 runbook. ✅
- Hardened entrypoint fingerprint guard → Tasks 1 + 2. ✅
- NULL-`project_id` preflight → Task 3 (folded into `cutover.sh` as a psql assertion; deviation from spec's standalone script noted above, YAGNI). ✅
- Fresh prod dump as source (not stale legacy) → Task 3 step 2. ✅
- Rehearsal against copied prod data → Task 3 `--rehearsal` + Task 4 + Manual execution. ✅
- Rollback (reverse rename, retain `tickets_old`) → Task 3 output + Task 4 §5. ✅
- 0-diff oracle gate → Task 3 verify step + Task 4 go/no-go. ✅
- Idle outbox worker / no backfill → documented in Task 4 smoke test + Global Constraints. ✅
- MCP known limitation → Task 4 + Global Constraints. ✅
- Marker tables `statuses` / `item_values` → Task 1. ✅

**Placeholder scan:** no TBD/TODO; every code/script/doc step carries full content. ✅

**Type consistency:** `classifySchema` / `SchemaKind` / `db:check-schema` names are identical across Tasks 1–2. Script/runbook command strings match across Tasks 3–4. ✅
