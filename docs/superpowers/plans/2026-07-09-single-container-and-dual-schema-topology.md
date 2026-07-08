# Single-container deploy + two-database dev topology — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the tickets stack its own dev database (`tickets_dev`) alongside prod (`tickets`) in a single `tickets-postgres` server, collapse the deployed services into one nginx-fronted container (API + Studio internal), and drive dev with `mprocs` — modeled on `../items-core`.

**Architecture:** Dev and prod are **two separate databases in one Postgres server**, selected by `POSTGRES_DATABASE` (already read by `@tickets/db`). Each database uses the default `public` schema, so the existing generated migrations apply verbatim — no schema rename, no search_path, no migration edits. The deployed stack becomes a single image running nginx + node API + Drizzle Studio under supervisord, with only nginx exposed.

**Tech Stack:** pnpm/turbo monorepo · Fastify-style API on `tsx` · Drizzle ORM + drizzle-kit (postgres-js driver) · Postgres 17 · nginx + supervisord (alpine) · mprocs.

## Why this shape (design note)

An earlier draft put prod and dev in two *schemas* of one database and switched via `search_path`. That is blocked: the committed migration SQL hardcodes `"public"` for all enums (`CREATE TYPE "public"."field_type"`) and all 24 FKs (`REFERENCES "public"."tickets"`), so a fresh migration into a non-`public` schema fails. Two databases (each on `public`) sidesteps this completely and needs no migration changes. Prod database `tickets` is left exactly as it is today.

## Global Constraints

- Node `>=20`; pnpm `9.15.0`; turbo `~2.9.6` (has `turbo watch`).
- Conventional commits, scoped: `feat(db):`, `feat(deploy):`, `chore(dev):`. One commit per task.
- A concurrent workstream may share this working tree: **never `git add -A`/`git add .`** — commit with explicit path-scoped form (`git commit <paths> -m …`).
- Dev/prod isolation is by **database name**, not schema: prod `POSTGRES_DATABASE=tickets`, dev `POSTGRES_DATABASE=tickets_dev`. Both use the `public` schema. No search_path, no schema rename.
- Ports (fixed): host web `4610` · internal api `4600` · internal studio `4983` · vite dev `4620` · dev postgres `5532` · in-container postgres `5432`.
- New dependencies go through the **add-package** skill before install (applies to `mprocs`).
- The deployed container is driven purely by compose `environment:` vars (`.dockerignore` excludes `.env`, verified — no dev override leaks into the image).
- Node's `process.loadEnvFile` (used by `@tickets/db/src/environment.ts`) loads the root `.env`; set dev values there rather than relying on shell overrides.

---

### Task 1: Publish `tickets-postgres` on 5532; retire the items-core dependency

Point dev tooling at the tickets stack's own Postgres server (currently unpublished). The dev database is created in Task 2.

**Files:**
- Modify: `docker-compose.yml` (postgres service only, in this task)

- [ ] **Step 1: Publish the postgres port**

In `docker-compose.yml`, add a `ports` mapping to the `postgres` service (keep healthcheck + volume):

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
Expected: `tickets-postgres-1` recreated (volume `tickets-pgdata` preserved), healthy.

- [ ] **Step 3: Verify host reachability + existing prod data intact**

```bash
docker exec -i tickets-postgres-1 psql -U postgres -d tickets -c "select count(*) from information_schema.tables where table_schema='public';"
```
Expected: `18` (prod tables untouched, still in `public`).

```bash
docker exec -i tickets-postgres-1 psql -U postgres -c "\l" | grep -E "tickets"
```
Expected: database `tickets` present (dev `tickets_dev` not yet — Task 2 creates it).

- [ ] **Step 4: Commit**

```bash
git commit docker-compose.yml -m "chore(deploy): publish tickets-postgres on 5532 for host dev tooling"
```

---

### Task 2: Create + seed the `tickets_dev` database; point dev env at it

Milestone: a self-owned dev database, fully migrated and seeded, isolated from prod.

**Files:**
- Modify: `.env` (root — set `POSTGRES_DATABASE`)
- Modify: `.env.example` (if present — document `tickets` vs `tickets_dev`)

**Interfaces:**
- Consumes: the published postgres on `127.0.0.1:5532` (Task 1); `pnpm --filter @tickets/db db:migrate` / `db:seed` (existing scripts, unchanged).

- [ ] **Step 1: Create the dev database**

```bash
docker exec -i tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_dev"
```
Expected: `CREATE DATABASE` (if it already exists, drop first with `DROP DATABASE tickets_dev` — dev data is disposable).

- [ ] **Step 2: Point dev `.env` at the dev database**

In the root `.env`, set (the key already exists — change its value):

```
POSTGRES_DATABASE=tickets_dev
```

Confirm the rest of `.env` reads `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5532`. If `.env.example` exists, set its `POSTGRES_DATABASE` to `tickets` with a comment: `# tickets (prod) | tickets_dev (local dev)`.

- [ ] **Step 3: Migrate + seed the dev database**

```bash
pnpm --filter @tickets/db db:migrate
```
Expected: `migrations applied` (reads `tickets_dev` from `.env`; runs the existing `public`-schema migrations cleanly).

```bash
pnpm --filter @tickets/db db:seed items-core "Items Core" TASK
```
Expected: `seeded project items-core …`.

- [ ] **Step 4: Verify isolation**

```bash
docker exec -i tickets-postgres-1 psql -U postgres -d tickets_dev -c "\dt" | grep -c "table"
docker exec -i tickets-postgres-1 psql -U postgres -d tickets_dev -c "select key from projects;"
```
Expected: dev tables present; `items-core` project listed. Prod database `tickets` is unaffected (separate database).

- [ ] **Step 5: Commit**

```bash
git commit .env.example -m "chore(dev): document POSTGRES_DATABASE (tickets | tickets_dev)"
```
(`.env` is gitignored — not committed. If `.env.example` does not exist, skip the commit and note it in the report.)

---

### Task 3: Unified Drizzle Studio config + `db:studio`

One Studio that browses whichever database `POSTGRES_DATABASE` names (items-core pattern), reused by dev and by the deployed container.

**Files:**
- Create: `drizzle.studio.config.ts` (repo root)
- Modify: `packages/db/package.json` (the `db:studio` script — currently `drizzle-kit studio`)

**Interfaces:**
- Consumes: `POSTGRES_*` env, loaded from the root `.env` when present (dev) or from process env (container).
- Produces: `pnpm --filter @tickets/db db:studio` serves Studio over the active database.

- [ ] **Step 1: Write the unified studio config**

Create `drizzle.studio.config.ts` at the repo root. drizzle-kit does not read `.env`, so load it here the same way `packages/db/src/environment.ts` does (walk up from cwd):

```ts
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// Standalone studio config (`pnpm db:studio`) — browses the POSTGRES_DATABASE
// database. drizzle-kit doesn't read .env, so load it here the same way
// packages/db/src/environment.ts does. NOT used for generate/migrate;
// packages/db/drizzle.config.ts owns those.
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

export default defineConfig({
  dialect: 'postgresql',
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

In `packages/db/package.json`, change the `db:studio` script (runs from `packages/db`, so the `.env` walk finds the root `.env`):

```json
    "db:studio": "drizzle-kit studio --config ../../drizzle.studio.config.ts",
```

- [ ] **Step 3: Verify Studio serves the dev database**

```bash
pnpm --filter @tickets/db db:studio &
sleep 6
curl -s -o /dev/null -w "studio -> HTTP %{http_code}\n" http://127.0.0.1:4983
```
Expected: log shows `Drizzle Studio is up and running…`; `studio -> HTTP 404` (server up). Stop it (Windows: `netstat -ano | grep :4983` then `taskkill //PID <pid> //F`).

- [ ] **Step 4: Commit**

```bash
git commit drizzle.studio.config.ts packages/db/package.json -m "feat(db): unified drizzle studio config over the active database"
```

---

### Task 4: `mprocs` dev flow (milestone: `pnpm dev` runs against `tickets_dev`)

**Files:**
- Create: `mprocs.yaml` (repo root)
- Modify: `package.json` (root — `dev` script + `mprocs` devDependency)

- [ ] **Step 1: Add `mprocs` via the add-package skill**

Invoke the **add-package** skill to add `mprocs` as a **root devDependency**. Do not hand-edit dependency lists — the skill presents candidates and installs.

- [ ] **Step 2: Write `mprocs.yaml`**

Create `mprocs.yaml` at the repo root:

```yaml
# Dev process dashboard, launched by `pnpm dev`.
# keys: up/down select pane, `r` restart, `x` stop, `q` quit.
# All panes target the tickets_dev database on 127.0.0.1:5532 (see .env).
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

- [ ] **Step 3: Point root `dev` at mprocs**

In root `package.json`, change:

```json
    "dev": "mprocs",
```

- [ ] **Step 4: Verify the dashboard end-to-end**

```bash
pnpm dev
```
Expected: mprocs dashboard with `api` (`:4600`), `web` (`:4620`), `studio`, `watchers` panes. In another shell:

```bash
curl -s -o /dev/null -w "web -> HTTP %{http_code}\n" http://127.0.0.1:4620
curl -s -w "\n" http://127.0.0.1:4620/api/projects
```
Expected: web `200`; `/api/projects` returns the seeded `items-core` project (proves vite → host api → `tickets_dev`). Quit with `q`.

- [ ] **Step 5: Commit**

```bash
git commit mprocs.yaml package.json pnpm-lock.yaml -m "chore(dev): mprocs dev dashboard targeting tickets_dev"
```

---

### Task 5: nginx routing — `/`, `/api/`, `/studio/` (studio = attempt + fallback)

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

Full same-origin verification happens in Task 7 (inside the container). Here, confirm the UI shell is reachable through the proxy path with a host studio up:

```bash
pnpm --filter @tickets/db db:studio &   # host studio on :4983
sleep 6
docker run --rm --network host -d --name nginx-probe -v "$(pwd)/docker/nginx.conf:/etc/nginx/http.d/default.conf:ro" nginx:alpine
curl -s -o /dev/null -w "studio ui -> HTTP %{http_code}\n" http://127.0.0.1/studio/
docker rm -f nginx-probe
# stop the host studio (netstat/taskkill on :4983)
```
Expected: a `2xx`/`3xx` from `local.drizzle.studio`. **If this returns errors that can't be resolved (TLS/asset-path), go to Step 4 (fallback). Otherwise skip Step 4.**

- [ ] **Step 4: FALLBACK (only if Step 3 fails) — studio out of nginx**

If same-origin proxying can't be made to work over local http:
1. Delete the two `/studio` `location` blocks from `docker/nginx.conf` (keep `/api/` and `/`).
2. In Task 6's `supervisord.conf`, omit the `[program:studio]` block.
3. Document the recipe: run studio on demand against the deployed DB with
   `docker compose exec app pnpm db:studio` then open the printed `local.drizzle.studio?port=4983` URL.

Record in the commit message which path (proxy or fallback) was taken.

- [ ] **Step 5: Commit**

```bash
git commit docker/nginx.conf -m "feat(deploy): nginx routes / + /api + /studio under one server"
```

---

### Task 6: supervisord + entrypoint

No cutover — prod database `tickets` already exists (created by the postgres image) and stays on `public`. The entrypoint just migrates and supervises.

**Files:**
- Create: `docker/supervisord.conf`
- Create: `docker/entrypoint.sh`

- [ ] **Step 1: Write supervisord program set**

Create `docker/supervisord.conf` (omit `[program:studio]` if Task 5 took the fallback):

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

- [ ] **Step 2: Write the entrypoint (migrate → supervise)**

Create `docker/entrypoint.sh`:

```sh
#!/bin/sh
set -e

# migrate the prod database (POSTGRES_DATABASE=tickets in the deployed env)
pnpm --filter @tickets/db db:migrate

# hand off to the process supervisor
exec supervisord -c /etc/supervisor/conf.d/tickets.conf
```

- [ ] **Step 3: Make it executable**

```bash
chmod +x docker/entrypoint.sh
git update-index --add --chmod=+x docker/entrypoint.sh 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git commit docker/supervisord.conf docker/entrypoint.sh -m "feat(deploy): supervisord + entrypoint (migrate, supervise)"
```

(No standalone runtime test here — verified as part of the container in Task 7.)

---

### Task 7: Combined `app` image + compose collapse (milestone: full deployed stack on :4610)

**Files:**
- Rewrite: `Dockerfile` (replace `api` / `web` targets with one `app` target; keep `deps`)
- Rewrite: `docker-compose.yml` (services `postgres` + `app`)

**Interfaces:**
- Consumes: `docker/nginx.conf`, `docker/supervisord.conf`, `docker/entrypoint.sh` (Tasks 5–6).

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
RUN apk add --no-cache nginx supervisor && corepack enable
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

- [ ] **Step 3: Build + bring up; watch migrate run**

```bash
docker compose up -d --build
docker compose logs app | grep -E "migrations applied"
```
Expected: `migrations applied` (against prod database `tickets`; a no-op since prod is already migrated).

- [ ] **Step 4: Verify everything is served under nginx**

```bash
curl -s -o /dev/null -w "web    -> HTTP %{http_code}\n" http://127.0.0.1:4610/
curl -s -o /dev/null -w "api    -> HTTP %{http_code}\n" http://127.0.0.1:4610/api/projects
curl -s -o /dev/null -w "studio -> HTTP %{http_code}\n" http://127.0.0.1:4610/studio/
```
Expected: web `200`; api `200` (prod projects); studio `200`/`3xx` (or omitted if fallback).

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
Expected: all pass. (`app.test.ts` builds its own ephemeral DB and is independent of `POSTGRES_DATABASE`.)

- [ ] **Step 7: Commit**

```bash
git commit Dockerfile docker-compose.yml -m "feat(deploy): single nginx-fronted container (api + studio internal)"
```

---

## Self-Review

**Spec coverage (revised — two databases):**
- Own dev database `tickets_dev` alongside prod `tickets` → Tasks 1, 2. ✓
- Env switch by `POSTGRES_DATABASE` (no search_path, no cutover) → Tasks 2, 7. ✓
- Unified studio over the active database → Task 3. ✓
- mprocs dev flow → Task 4. ✓
- Combined container: nginx + api + studio, only nginx exposed → Tasks 5, 6, 7. ✓
- Studio locked to localhost + fallback → Task 5. ✓
- Regression (isolated integration test) → Task 7 Step 6. ✓

**Removed vs the first draft:** the `search_path`/`POSTGRES_SCHEMA` db-layer change and the guarded `public → tickets` cutover script — both unnecessary and unsafe under separate databases. Prod database `tickets` is never rewritten.

**Placeholder scan:** none; every config/script shown in full. The only conditional is Task 5 Step 4 (fallback), itself fully specified.

**Type/name consistency:** `POSTGRES_DATABASE` is the single switch across `.env` (Task 2), studio config (Task 3), and compose (Task 1/7); prod=`tickets`, dev=`tickets_dev` everywhere. `docker/nginx.conf`, `docker/supervisord.conf`, `docker/entrypoint.sh` paths are identical wherever referenced. `db:migrate`/`db:seed`/`db:studio` scripts are used as they exist in `packages/db` (migrate.ts unchanged).
