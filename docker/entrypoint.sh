#!/bin/sh
set -e

# migrate the prod database (POSTGRES_DATABASE=tickets in the deployed env)
pnpm --filter @tickets/db db:migrate

# hand off to the process supervisor
exec supervisord -c /etc/supervisor/conf.d/tickets.conf
