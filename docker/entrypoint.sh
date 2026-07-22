#!/bin/sh
set -e

# SP4c cutover guard: refuse to migrate an un-swapped OLD-schema production DB.
# Exits non-zero (aborting the boot via `set -e`) if POSTGRES_DATABASE still
# holds the pre-items schema. See docs/runbooks/sp4c-cutover.md.
pnpm --filter @tickets/db db:check-schema

# migrate the prod database (POSTGRES_DATABASE=tickets in the deployed env)
pnpm --filter @tickets/db db:migrate

# migrate the signals database too, and do it here rather than inside its
# supervisord program: supervisord has no port-ready healthcheck, so it
# considers a process "started" the instant its shell spawns — if db:create
# + db:migrate ran as part of the `signals` program's own command (as they
# used to), the collector's HTTP server wouldn't bind for several seconds
# while api's program starts immediately in parallel and calls ensureAppDsn
# with a 2s budget, losing the race on every boot (observed: "[signals] no
# DSN available" every time, self-registration never actually landing).
# Doing the migration here, before supervisord exists, means the `signals`
# program only has to run `start` — as fast to bind as `api` is — so the two
# race on comparable footing instead of api always losing.
pnpm --filter @tickets/signals db:create
pnpm --filter @tickets/signals db:migrate

# hand off to the process supervisor
exec supervisord -c /etc/supervisor/conf.d/tickets.conf
