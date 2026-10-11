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
