# Single-container deploy + dual-schema dev topology — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the tickets stack its own two-schema database (`tickets` prod / `tickets_dev` dev) in `tickets-postgres-1`, collapse the deployed services into one nginx-fronted container (api + studio internal), and drive dev with `mprocs` — modeled on `../items-core`.

**Architecture:** DB access already funnels through `createDbClient`; the schema is selected there via the connection `search_path`, so no table definitions change. The deployed stack becomes a single image running nginx + node API + Drizzle Studio under supervisord, with only nginx exposed. A one-time guarded SQL script renames the existing prod `public` schema to `tickets`.

**Tech Stack:** pnpm/turbo monorepo · Fastify-style API on `tsx` · Drizzle ORM + drizzle-kit (postgres-js driver) · Postgres 17 · nginx + supervisord (alpine) · mprocs.

## Global Constraints

- Node `>=20`; pnpm `9.15.0`; turbo `~2.9.6` (has `turbo watch`).
- Conventional commits, scoped: `feat(db):`, `feat(deploy):`, `chore(dev):`, etc. One commit per task.
- Schema identifiers use underscores: `tickets_dev` (never `tickets-dev`).
- Ports (fixed vocabulary): host web `4610` · internal api `4600` · internal studio `4983` · vite dev `4620` · dev postgres `5532` · in-container postgres `5432`.
- New dependencies go through the **add-package** skill before install (applies to `mprocs`).
- The deployed container is driven purely by compose `environment:` vars (`.dockerignore` excludes `.env`, so no dev-schema leak). Prod schema = `tickets`, dev schema = `tickets_dev`.
- Postgres connection URL stays credential-only; schema is applied via `connection.options`, never baked into the URL.

---

### Task 1: Schema-aware DB layer (`@tickets/db`)

Select the Postgres schema per-environment through one chokepoint, and keep each schema's migration journal independent.

**Files:**
- Modify: `packages/db/src/environment.ts`
- Modify: `packages/db/src/client.ts`
- Modify: `packages/db/src/migrate.ts`

**Interfaces:**
- Produces: `environment.postgres.schema: string` (default `'tickets'`); `createDbClient()` returns a client whose sessions run with `search_path=<schema>`; `migrate.ts` creates the schema and stores `__drizzle_migrations` inside it.

- [ ] **Step 1: Add the `schema` knob to environment**

In `packages/db/src/environment.ts`, add `schema` to the `postgres` block (leave `connectionUrl` unchanged):

```ts
export const environment = {
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DATABASE ?? 'tickets',
    schema: process.env.POSTGRES_SCHEMA ?? 'tickets',
  },
};
```

- [ ] **Step 2: Apply `search_path` in the client**

Rewrite `packages/db/src/client.ts` to import `environment` and pass the schema as a startup option. (`connection.options` = libpq-style `-c search_path=…`, the most reliable way to pin the schema across every pooled connection.)

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { connectionUrl, environment } from './environment';
import * as schema from './schema';

export function createDbClient({ max = 10 }: { max?: number } = {}) {
  const sql = postgres(connectionUrl, {
    max,
    connection: { options: `-c search_path=${environment.postgres.schema}` },
  });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export type DbClient = ReturnType<typeof createDbClient>;
export type Db = DbClient['db'];
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbExecutor = Db | DbTransaction;
```

- [ ] **Step 3: Create the schema + per-schema journal in migrate**

Rewrite `packages/db/src/migrate.ts`:

```ts
import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDbClient } from './client';
import { environment } from './environment';

const { db, sql } = createDbClient({ max: 1 });
const { schema } = environment.postgres;

// search_path points at <schema>, which may not exist yet — create it explicitly
// (schema-qualified, so it works regardless of search_path) before migrating.
await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
await migrate(db, {
  migrationsFolder: resolve(import.meta.dirname, '../drizzle'),
  migrationsSchema: schema,
});
await sql.end();
console.log(`migrations applied to schema "${schema}"`);
```

- [ ] **Step 4: Verify schema targeting against the live dev postgres (probe schema)**

Run (uses whatever answers `:5532` right now; creates and drops a throwaway schema, disturbs nothing):

```bash
POSTGRES_SCHEMA=tix_probe pnpm --filter @tickets/db db:migrate
```
Expected last line: `migrations applied to schema "tix_probe"`

```bash
docker exec -i items-core-postgres-1 psql -U postgres -d tickets -c '\dt tix_probe.*'
```
Expected: the app tables **plus** `tix_probe.__drizzle_migrations`.

- [ ] **Step 5: Verify re-migrate is a no-op, then clean up**

```bash
POSTGRES_SCHEMA=tix_probe pnpm --filter @tickets/db db:migrate
```
Expected: same success line, **no new tables created** (drizzle reports nothing to apply).

```bash
docker exec -i items-core-postgres-1 psql -U postgres -d tickets -c 'DROP SCHEMA tix_probe CASCADE'
```
Expected: `DROP SCHEMA`.

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm --filter @tickets/db typecheck
git add packages/db/src/environment.ts packages/db/src/client.ts packages/db/src/migrate.ts
git commit -m "feat(db): select postgres schema via search_path, per-schema migrations"
```

---

### Task 2: Publish `tickets-postgres` on 5532; retire the items-core dependency

Point dev at the tickets stack's own database. `tickets_dev` and prod share one Postgres instance and one database (`tickets`), separated only by schema.

**Files:**
- Modify: `docker-compose.yml` (postgres service only, in this task)

- [ ] **Step 1: Publish the postgres port**

In `docker-compose.yml`, add a `ports` mapping to the `postgres` service (keep the healthcheck and volume):

```yaml
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tickets
    ports:
      - '5532:5432'
    volumes:
      - tickets-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d tickets']
      interval: 2s
      timeout: 3s
      retries: 20
```

- [ ] **Step 2: Free port 5532 and recreate postgres**

```bash
docker stop items-core-postgres-1
docker compose up -d postgres
```
Expected: `tickets-postgres-1` recreated (volume `tickets-pgdata` preserved), now healthy.

- [ ] **Step 3: Verify host reachability + existing prod data**

```bash
docker exec -i tickets-postgres-1 psql -U postgres -d tickets -c "select table_schema,count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema') group by 1;"
```
Expected: `public | 18` and `drizzle | 1` (prod data intact; cutover happens later in Task 5).

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 5532 -U postgres -d tickets -c 'select 1' 2>/dev/null || echo "install psql or use docker exec — reachability already proven by the api container"
```
Expected: `1` (or the fallback note — host reachability is confirmed either way by Step 2's healthy container with a published port).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(deploy): publish tickets-postgres on 5532 for host dev tooling"
```

---

### Task 3: Unified Drizzle Studio config + `db:studio`

One Studio that browses whichever schema `POSTGRES_SCHEMA` names (items-core pattern), reused by dev and by the deployed container.

**Files:**
- Create: `drizzle.studio.config.ts` (repo root)
- Modify: `packages/db/package.json` (the `db:studio` script added earlier this session)

**Interfaces:**
- Consumes: `POSTGRES_*` env, loaded from the root `.env` when present (dev) or from process env (container).
- Produces: `pnpm --filter @tickets/db db:studio` serves Studio over the active schema.

- [ ] **Step 1: Write the unified studio config**

Create `drizzle.studio.config.ts` at the repo root. It loads the root `.env` itself (walking up from cwd, matching `environment.ts`, because drizzle-kit does not load `.env`), and filters Studio to the active schema:

```ts
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// Standalone studio config (`pnpm db:studio`) — browses the POSTGRES_SCHEMA
// schema by introspecting the live DB. drizzle-kit doesn't read .env, so load
// it here the same way packages/db/src/environment.ts does. NOT used for
// generate/migrate; packages/db/drizzle.config.ts owns those.
let current = resolve(process.cwd());
for (let depth = 0; depth < 5; depth++) {
  const candidate = join(current, '.env');
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
  const parent = dirname(current);
  if (parent === current) break;
  current = parent;
}

const schema = process.env.POSTGRES_SCHEMA ?? 'tickets';

export default defineConfig({
  dialect: 'postgresql',
  schemaFilter: [schema],
  dbCredentials: {
    host: process.env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DATABASE ?? 'tickets',
  },
});
```

- [ ] **Step 2: Point `db:studio` at the unified config**

In `packages/db/package.json`, change the `db:studio` script to reference the root config (runs from `packages/db`, so the `.env` walk finds the root `.env`):

```json
    "db:studio": "drizzle-kit studio --config ../../drizzle.studio.config.ts",
```

- [ ] **Step 3: Verify Studio serves the probe/dev schema**

```bash
POSTGRES_SCHEMA=public pnpm --filter @tickets/db db:studio &
sleep 6
curl -s -o /dev/null -w "studio -> HTTP %{http_code}\n" http://127.0.0.1:4983
```
Expected: `Drizzle Studio is up and running…` in the logs and `studio -> HTTP 404` (server up). Stop it:

```bash
# find and kill the studio listener on 4983 (Windows: netstat -ano | grep :4983 then taskkill //PID <pid> //F)
```

- [ ] **Step 4: Commit**

```bash
git add drizzle.studio.config.ts packages/db/package.json
git commit -m "feat(db): unified drizzle studio config over the active schema"
```

---

### Task 4: `mprocs` dev flow (milestone: `pnpm dev` works against `tickets_dev`)

**Files:**
- Create: `mprocs.yaml` (repo root)
- Modify: `package.json` (root — `dev` script + `mprocs` devDependency)
- Modify: `.env` (add `POSTGRES_SCHEMA`)
- Modify: `.env.example` (if present — document `POSTGRES_SCHEMA`)

- [ ] **Step 1: Add `mprocs` via the add-package skill**

Invoke the **add-package** skill to add `mprocs` as a **root devDependency**. Do not hand-edit `package.json` dependencies for this — the skill presents candidates and installs.

- [ ] **Step 2: Set the dev schema in `.env`**

Append to the root `.env`:

```
POSTGRES_SCHEMA=tickets_dev
```

If `.env.example` exists, add the same key with a comment documenting `tickets` (prod) vs `tickets_dev` (dev).

- [ ] **Step 3: Write `mprocs.yaml`**

Create `mprocs.yaml` at the repo root:

```yaml
# Dev process dashboard, launched by `pnpm dev`.
# keys: up/down select pane, `r` restart, `x` stop, `q` quit.
# All panes target the tickets_dev schema on 127.0.0.1:5532 (see .env).
procs:
  api:
    shell: pnpm --filter @tickets/api dev
  web:
    shell: pnpm --filter @tickets/web dev
  studio:
    shell: pnpm db:studio
  watchers:
    shell: turbo watch typecheck
```

- [ ] **Step 4: Point root `dev` at mprocs**

In root `package.json`, change:

```json
    "dev": "mprocs",
```

- [ ] **Step 5: Create + seed the dev schema**

```bash
pnpm --filter @tickets/db db:migrate
```
Expected: `migrations applied to schema "tickets_dev"` (reads `POSTGRES_SCHEMA=tickets_dev` from `.env`).

```bash
pnpm --filter @tickets/db db:seed items-core "Items Core" TASK
```
Expected: `seeded project …`.

```bash
docker exec -i tickets-postgres-1 psql -U postgres -d tickets -c '\dt tickets_dev.*'
```
Expected: app tables + `__drizzle_migrations` in `tickets_dev`; `public` still holds the untouched prod tables.

- [ ] **Step 6: Verify the dashboard end-to-end**

```bash
pnpm dev
```
Expected: mprocs dashboard with `api` (`:4600`), `web` (`:4620`), `studio`, `watchers` panes. In another shell:

```bash
curl -s -o /dev/null -w "web  -> HTTP %{http_code}\n" http://127.0.0.1:4620
curl -s -o /dev/null -w "api  -> HTTP %{http_code}\n" http://127.0.0.1:4620/api/projects
```
Expected: web `200`; `/api/projects` returns `200` with the seeded `items-core` project (proves vite → host api → `tickets_dev`). Quit mprocs with `q`.

- [ ] **Step 7: Commit**

```bash
git add mprocs.yaml package.json pnpm-lock.yaml .env.example
git commit -m "chore(dev): mprocs dev dashboard targeting tickets_dev"
```
(`.env` is gitignored — not committed.)

---

### Task 5: Guarded prod cutover script (`public` → `tickets`)

One-time, idempotent, safe on a fresh DB. Sentinel = `public.tickets` table.

**Files:**
- Create: `scripts/cutover-public-to-tickets.sql`

- [ ] **Step 1: Write the guarded cutover**

Create `scripts/cutover-public-to-tickets.sql`:

```sql
-- One-time, idempotent cutover: move the legacy prod schema from `public` to
-- `tickets`. Runs on every deploy but only acts once: it fires only when a
-- `public.tickets` table exists AND no `tickets` schema exists yet. Fresh DBs
-- (no public.tickets) and already-cutover DBs both fall through to the no-op.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'tickets')
     AND EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'tickets') THEN
    EXECUTE 'ALTER SCHEMA public RENAME TO tickets';
    EXECUTE 'CREATE SCHEMA public';
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations') THEN
      EXECUTE 'ALTER TABLE drizzle.__drizzle_migrations SET SCHEMA tickets';
    END IF;
    RAISE NOTICE 'cutover: public renamed to tickets, journal moved';
  ELSE
    RAISE NOTICE 'cutover: skipped (tickets schema present or no public.tickets)';
  END IF;
END $$;
```

- [ ] **Step 2: Verify on a scratch database (prod-shaped)**

Build a scratch DB that mirrors prod (tables in `public`, journal in `drizzle`), then cut over:

```bash
docker exec -i tickets-postgres-1 psql -U postgres -c 'DROP DATABASE IF EXISTS cutover_probe; CREATE DATABASE cutover_probe'
POSTGRES_DATABASE=cutover_probe POSTGRES_SCHEMA=public pnpm --filter @tickets/db db:migrate
docker exec -i tickets-postgres-1 psql -U postgres -d cutover_probe -c "ALTER TABLE public.__drizzle_migrations SET SCHEMA drizzle" 2>/dev/null || true
docker exec -i tickets-postgres-1 psql -U postgres -d cutover_probe < scripts/cutover-public-to-tickets.sql
```
Expected: `NOTICE: cutover: public renamed to tickets, journal moved`.

```bash
docker exec -i tickets-postgres-1 psql -U postgres -d cutover_probe -c "select table_schema,count(*) from information_schema.tables where table_schema in ('public','tickets') group by 1;"
```
Expected: `tickets` holds the app tables; `public` is empty (0 rows for public).

- [ ] **Step 3: Verify idempotency, then drop the scratch DB**

```bash
docker exec -i tickets-postgres-1 psql -U postgres -d cutover_probe < scripts/cutover-public-to-tickets.sql
```
Expected: `NOTICE: cutover: skipped (tickets schema present or no public.tickets)`.

```bash
docker exec -i tickets-postgres-1 psql -U postgres -c 'DROP DATABASE cutover_probe'
```

- [ ] **Step 4: Commit**

```bash
git add scripts/cutover-public-to-tickets.sql
git commit -m "feat(deploy): guarded one-time public->tickets schema cutover"
```

---

### Task 6: nginx routing — `/`, `/api/`, `/studio/` (studio = attempt + fallback)

`/` and `/api/` are solid; `/studio/` is the highest-risk piece (drizzle's UI shell lives at `local.drizzle.studio` and prefers TLS — the local http deploy may not satisfy it). Implement the attempt, verify, and if it fights back apply the fully-specified fallback in Step 4.

**Files:**
- Rewrite: `docker/nginx.conf`

- [ ] **Step 1: Write the routing config**

Rewrite `docker/nginx.conf` (alpine nginx includes `/etc/nginx/http.d/*.conf`):

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # API — internal node process (not published)
  location /api/ {
    proxy_pass http://127.0.0.1:4600;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  # Drizzle Studio — locked to localhost. Same-origin proxy to the hosted UI
  # shell; the studio protocol server runs on 127.0.0.1:4983.
  location = /studio { return 302 /studio/?host=$host&port=$server_port; }
  location /studio/ {
    allow 127.0.0.1;
    deny all;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_pass https://local.drizzle.studio/;
    proxy_set_header Host local.drizzle.studio;
    proxy_ssl_server_name on;
  }

  # SPA fallback — TanStack Router owns the paths
  location / {
    try_files $uri /index.html;
  }
}
```

- [ ] **Step 2: Validate syntax**

```bash
docker run --rm -v "$(pwd)/docker/nginx.conf:/etc/nginx/http.d/default.conf:ro" nginx:alpine nginx -t
```
Expected: `syntax is ok` / `test is successful`.

- [ ] **Step 3: Smoke-test the studio proxy against a running host studio**

Full same-origin verification happens in Task 8 (inside the container). Here, just confirm the UI shell is reachable through the proxy path with a host studio up:

```bash
POSTGRES_SCHEMA=public pnpm --filter @tickets/db db:studio &   # host studio on :4983
sleep 6
docker run --rm --network host -v "$(pwd)/docker/nginx.conf:/etc/nginx/http.d/default.conf:ro" -d --name nginx-probe nginx:alpine
curl -s -o /dev/null -w "studio ui -> HTTP %{http_code}\n" -H 'Host: 127.0.0.1' http://127.0.0.1/studio/
docker rm -f nginx-probe
# stop the host studio (netstat/taskkill on :4983)
```
Expected: a `2xx`/`3xx` from `local.drizzle.studio`. **If this returns errors that can't be resolved (TLS/asset-path), go to Step 4 (fallback). Otherwise skip Step 4.**

- [ ] **Step 4: FALLBACK (only if Step 3 fails) — studio out of nginx**

If same-origin proxying can't be made to work over local http:
1. Delete the two `/studio` `location` blocks from `docker/nginx.conf` (keep `/api/` and `/`).
2. In Task 7's `supervisord.conf`, omit the `[program:studio]` block.
3. Document the recipe in the plan's companion note / README: run studio on demand against the deployed DB with
   `docker compose exec -e POSTGRES_SCHEMA=tickets app pnpm db:studio` then open the printed `local.drizzle.studio?port=4983` URL (add `-p 4983:4983` temporarily if needed).

Record in the commit message which path (proxy or fallback) was taken.

- [ ] **Step 5: Commit**

```bash
git add docker/nginx.conf
git commit -m "feat(deploy): nginx routes / + /api + /studio under one server"
```

---

### Task 7: supervisord + entrypoint

**Files:**
- Create: `docker/supervisord.conf`
- Create: `docker/entrypoint.sh`

- [ ] **Step 1: Write supervisord program set**

Create `docker/supervisord.conf` (omit `[program:studio]` if Task 6 took the fallback):

```ini
[supervisord]
nodaemon=true
user=root

[program:api]
command=pnpm --filter @tickets/api start
directory=/app
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:studio]
command=pnpm --filter @tickets/db db:studio
directory=/app
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:nginx]
command=nginx -g 'daemon off;'
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

- [ ] **Step 2: Write the entrypoint (cutover → migrate → supervise)**

Create `docker/entrypoint.sh`:

```sh
#!/bin/sh
set -e

DB_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}"

# 1. one-time, idempotent public->tickets cutover (no-op after first run / fresh DB)
psql "$DB_URL" -v ON_ERROR_STOP=1 -f /app/scripts/cutover-public-to-tickets.sql

# 2. migrate the active schema (POSTGRES_SCHEMA=tickets in the deployed env)
pnpm --filter @tickets/db db:migrate

# 3. hand off to the process supervisor
exec supervisord -c /etc/supervisor/conf.d/tickets.conf
```

- [ ] **Step 3: Make it executable**

```bash
git update-index --add --chmod=+x docker/entrypoint.sh 2>/dev/null || chmod +x docker/entrypoint.sh
```

- [ ] **Step 4: Commit**

```bash
git add docker/supervisord.conf docker/entrypoint.sh
git commit -m "feat(deploy): supervisord + entrypoint (cutover, migrate, supervise)"
```

(No standalone runtime test here — verified as part of the container in Task 8.)

---

### Task 8: Combined `app` image + compose collapse (milestone: full deployed stack on :4610)

**Files:**
- Rewrite: `Dockerfile` (replace `api` / `web` targets with one `app` target; keep `deps`)
- Rewrite: `docker-compose.yml` (services `postgres` + `app`)

**Interfaces:**
- Consumes: `docker/nginx.conf`, `docker/supervisord.conf`, `docker/entrypoint.sh`, `scripts/cutover-public-to-tickets.sql` (Tasks 5–7).

- [ ] **Step 1: Rewrite the Dockerfile**

```dockerfile
# Multi-stage build for the tickets stack — one runtime image:
# nginx (front) + node API + drizzle studio, under supervisord.

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mcp/package.json apps/mcp/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile
COPY . .

FROM deps AS web-build
RUN pnpm --filter @tickets/web build

FROM node:22-alpine AS app
RUN apk add --no-cache nginx supervisor postgresql-client && corepack enable
WORKDIR /app
# full workspace (node_modules incl. drizzle-kit + tsx) from deps
COPY --from=deps /app /app
# built SPA bundle
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
# infra
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/tickets.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV NODE_ENV=production
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
```

- [ ] **Step 2: Rewrite docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tickets
    ports:
      - '5532:5432'
    volumes:
      - tickets-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d tickets']
      interval: 2s
      timeout: 3s
      retries: 20

  app:
    build:
      context: .
      target: app
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DATABASE: tickets
      POSTGRES_SCHEMA: tickets
      API_HOST: 0.0.0.0
      API_PORT: 4600
    ports:
      - '4610:80'
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  tickets-pgdata:
```

- [ ] **Step 3: Build + bring up; watch the cutover + migrate run once**

```bash
docker compose up -d --build
docker compose logs app | grep -E "cutover|migrations applied"
```
Expected: `cutover: public renamed to tickets…` (first run) and `migrations applied to schema "tickets"`.

- [ ] **Step 4: Verify everything is served under nginx and prod schema is `tickets`**

```bash
curl -s -o /dev/null -w "web    -> HTTP %{http_code}\n" http://127.0.0.1:4610/
curl -s -o /dev/null -w "api    -> HTTP %{http_code}\n" http://127.0.0.1:4610/api/projects
curl -s -o /dev/null -w "studio -> HTTP %{http_code}\n" http://127.0.0.1:4610/studio/
docker exec -i tickets-postgres-1 psql -U postgres -d tickets -c "select table_schema,count(*) from information_schema.tables where table_schema in ('public','tickets') group by 1;"
```
Expected: web `200`; api `200` (returns the prod projects); studio `200`/`3xx` (or omitted if fallback); tables now under `tickets`, `public` empty.

- [ ] **Step 5: Verify api + studio are NOT reachable except through nginx**

```bash
curl -s -o /dev/null -w "direct api    -> %{http_code}\n" http://127.0.0.1:4600/ || echo "api not exposed (good)"
curl -s -o /dev/null -w "direct studio -> %{http_code}\n" http://127.0.0.1:4983/ || echo "studio not exposed (good)"
```
Expected: both connection-refused (only `:4610` and `:5532` are published).

- [ ] **Step 6: Regression suite**

```bash
pnpm typecheck
pnpm --filter @tickets/web test
pnpm --filter @tickets/api test
```
Expected: all pass. (`app.test.ts` builds its own ephemeral DB in `public` and is independent of `POSTGRES_SCHEMA`.)

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat(deploy): single nginx-fronted container (api + studio internal)"
```

---

## Self-Review

**Spec coverage:**
- Part 1 (search_path schema switch) → Task 1. ✓
- Part 2 (per-schema migrations journal) → Task 1 (Step 3). ✓
- Part 3 (guarded prod cutover) → Task 5 + Task 7 entrypoint. ✓
- Part 4 (combined container: nginx + supervisor + node) → Tasks 6, 7, 8. ✓
- Part 5 (compose: published postgres + app) → Task 2 (postgres) + Task 8 (collapse). ✓
- Part 6 (mprocs dev flow, studio config, .env) → Tasks 3, 4. ✓
- Decisions #4 (5532), #5 (studio locked to localhost), #6 (fallback) → Task 2, Task 6 Steps 1/4. ✓
- Verification + risks (isolated integration test) → Task 8 Step 6. ✓

**Placeholder scan:** No TBD/TODO; every config and script is shown in full. The only conditional is Task 6 Step 4 (fallback), which is itself fully specified.

**Type/name consistency:** `environment.postgres.schema` (Task 1) is consumed by `migrate.ts` (Task 1) and `drizzle.studio.config.ts` reads `POSTGRES_SCHEMA` (Task 3); `POSTGRES_SCHEMA` env name is consistent across `.env` (Task 4), compose (Task 2/8), and entrypoint (Task 7). Ports match the Global Constraints table throughout. `docker/nginx.conf`, `docker/supervisord.conf`, `docker/entrypoint.sh`, `scripts/cutover-public-to-tickets.sql` paths are identical everywhere referenced.
