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
# Anchor backups to the repo root (this script's parent dir), NOT the caller's
# CWD: LEGACY_DUMP is handed to `pnpm --filter @tickets/db db:restore-legacy`,
# which runs in packages/db — a relative path would resolve there and break.
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/backups"
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
    "SELECT count(*) FROM history.events WHERE aggregate_type='item' AND project_id IS NULL" $TARGET)"
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
