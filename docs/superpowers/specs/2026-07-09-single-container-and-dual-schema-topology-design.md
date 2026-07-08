# Single-container deploy + dual-schema dev topology

**Date:** 2026-07-09
**Status:** Approved; **revised during execution — see revision note**
**Branch:** `redesign`

> **REVISION (2026-07-09, during execution):** The two-*schema* + `search_path`
> approach below is **superseded**. The committed migration SQL hardcodes
> `"public"` for all enums and FKs, so a fresh migration into a non-`public`
> schema fails. Decision (confirmed with user): use **two separate databases in
> one Postgres server** — prod `tickets` (unchanged, on `public`) and dev
> `tickets_dev` (new, on `public`) — switched by the existing `POSTGRES_DATABASE`
> env var. This **drops** Part 1's `search_path`/`POSTGRES_SCHEMA` change and
> **deletes** Part 3's `public → tickets` cutover entirely. The single-container
> deploy (Parts 4–6) is unchanged except the entrypoint no longer runs a cutover.
> The authoritative task list is the implementation plan:
> `docs/superpowers/plans/2026-07-09-single-container-and-dual-schema-topology.md`.

## Summary

Two coupled infrastructure changes, modeled on the sibling `../items-core` project:

1. **Stop borrowing `items-core-postgres-1` for dev.** The tickets stack gets its own
   two-schema database inside `tickets-postgres-1`: `tickets` (prod) and `tickets_dev`
   (dev), selected per-environment via the connection `search_path`.
2. **Collapse the deployed stack into one container.** A single image runs nginx + the
   node API + Drizzle Studio under a process supervisor. Only nginx is exposed
   (host `:4610`); the API and Studio are internal, reached through nginx (`/api`,
   `/studio`). Dev is driven by `mprocs`, like items-core.

## Motivation / current state

- Dev currently points at `items-core-postgres-1` (host `:5532`) — an unrelated
  project's database that happens to be published. We want tickets self-contained.
- The deployed stack exposes three things: `api` (`:4600`), `web` (`:4610`),
  `postgres` (unpublished). The API being independently reachable is unwanted;
  everything should be served under one nginx.
- Prod DB today: 18 app tables in `public`, drizzle migration journal in a separate
  `drizzle` schema (confirmed via `\dn`). This makes the schema rename clean.
- All application DB access funnels through `createDbClient` in
  `packages/db/src/client.ts` (`postgres(connectionUrl) → drizzle(sql, {schema})`).
  Tables are defined unqualified (`pgTable`), so they land in whatever schema the
  `search_path` selects — no per-table changes are needed to move schemas.

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | API exposure | **One combined container** (nginx + api + studio), supervisor-managed |
| 2 | Existing prod data | **Rename `public` → `tickets`**; dev is a fresh `tickets_dev` |
| 3 | Studio location | **Also served in the deployed stack**, behind nginx at `/studio/` |
| 4 | Dev DB port | Reuse **`5532`** (publish `tickets-postgres`; stop `items-core-postgres`) |
| 5 | `/studio` access in prod | Locked down — nginx `allow 127.0.0.1; deny all;` **or** HTTP basic-auth |
| 6 | Studio-proxy fallback | If the nginx same-origin proxy proves too fiddly, fall back to studio dev-only + a documented `docker compose exec` recipe (studio-in-container is the one soft requirement) |

Schema names use an underscore (`tickets_dev`) — hyphens force identifier quoting everywhere.

## Design

### Part 1 — Two schemas via `search_path`

Single chokepoint: `packages/db/src/environment.ts` + `client.ts`.

- `environment.ts`: add `schema: process.env.POSTGRES_SCHEMA ?? 'tickets'` to the
  exported `environment.postgres`. Keep `connectionUrl` as-is (schema is applied via
  connection options, not the URL, so it stays out of logs/credentials).
- `client.ts`: `postgres(connectionUrl, { max, connection: { search_path: schema } })`.
  Every consumer (API, migrate, seed, tsx scripts) inherits the right schema for free.

Prod (`docker`) sets `POSTGRES_SCHEMA=tickets`; dev (`.env`) sets `POSTGRES_SCHEMA=tickets_dev`.

### Part 2 — Migrations are per-schema

`packages/db/src/migrate.ts`:

1. Before migrating, ensure the target schema exists:
   `CREATE SCHEMA IF NOT EXISTS "<schema>"` (raw `sql.unsafe`, runs under the same
   connection whose `search_path` is already the target schema).
2. Call `migrate(db, { migrationsFolder, migrationsSchema: schema })` so the
   `__drizzle_migrations` journal lives **inside the app schema**. This keeps
   `tickets` and `tickets_dev` migration histories independent.

`drizzle.config.ts` (used only by `drizzle-kit generate`) is unaffected — generate
diffs schema files against snapshots and does not touch a live DB.

### Part 3 — Prod cutover (one-time)

Runs once against the existing prod DB, before the first migrate under the new scheme:

```sql
ALTER SCHEMA public RENAME TO tickets;                       -- 18 app tables move
CREATE SCHEMA public;                                        -- restore public (extensions, etc.)
ALTER TABLE drizzle.__drizzle_migrations SET SCHEMA tickets; -- journal joins the app schema
```

After this, `db:migrate` with `migrationsSchema=tickets` sees every migration already
applied → no-op. The one-time step is delivered as a small guarded script (skip if
`tickets` schema already exists) invoked by the container entrypoint, so a fresh DB and
an existing prod DB both converge.

Dev needs no cutover: `tickets_dev` is created empty, migrated, then seeded
(`pnpm db:seed …`).

### Part 4 — Combined container

Base `node:22-alpine` + `apk add nginx supervisor`. Multi-stage:

- `deps` (existing) — full install (drizzle-kit + tsx already present).
- `web-build` (existing) — `pnpm --filter @tickets/web build` → `dist`.
- `app` (new final target) — node + deps + nginx + supervisor; copies web `dist` into
  the nginx html root.

Entrypoint: run the cutover-or-noop + `db:migrate`, then `exec supervisord`.

Supervisord programs:

| Program | Command | Bind | Exposed |
|---|---|---|---|
| nginx | `nginx -g 'daemon off;'` | `:80` | host `:4610` |
| api | `pnpm --filter @tickets/api start` (`tsx src/server.ts`) | `127.0.0.1:4600` | no |
| studio | `pnpm db:studio` (host `0.0.0.0`, port `4983`) | `127.0.0.1:4983` | no |

nginx routing:

- `location /` → static SPA (`try_files $uri /index.html`).
- `location /api/` → `proxy_pass http://127.0.0.1:4600;` (Host + X-Forwarded-For, as today).
- `location /studio/` → same-origin proxy, porting medialib's Caddy recipe:
  - `GET /` (studio root) → redirect to `/studio/?host=<host>&port=<port>`.
  - `/studio/*` → `proxy_pass https://local.drizzle.studio` with `proxy_set_header Host local.drizzle.studio` (the UI shell).
  - other studio protocol paths (POSTed queries, websockets) → local `127.0.0.1:4983`,
    with `Upgrade`/`Connection` headers for websockets.
  - guard the whole block with `allow 127.0.0.1; deny all;` **or** basic-auth (decision #5).

**Highest-risk task.** Build and verify the `/studio/` proxy in isolation first. If it
resists nginx, apply the decision-#6 fallback.

### Part 5 — docker-compose

Two services:

- `postgres` — `postgres:17-alpine`, now **published `5532:5432`** (host dev tools need
  it), env unchanged.
- `app` — the combined image, `4610:80`, env `POSTGRES_HOST=postgres`,
  `POSTGRES_PORT=5432`, `POSTGRES_SCHEMA=tickets`, `API_HOST=0.0.0.0`, etc.

The old `api` and `web` services are removed. `items-core-postgres-1` is no longer a
dependency and can be stopped.

### Part 6 — Dev flow via `mprocs`

- New root dev dependency **`mprocs`** (routed through the `add-package` skill before install).
- `mprocs.yaml` at repo root, panes all targeting `tickets_dev` on `127.0.0.1:5532`:

  | Pane | Command |
  |---|---|
  | api | `pnpm --filter @tickets/api dev` (tsx watch, `:4600`) |
  | web | `pnpm --filter @tickets/web dev` (vite `:4620`, proxies `/api` → `127.0.0.1:4600`) |
  | studio | `pnpm db:studio` |
  | watchers | `turbo typecheck --watch` (everything else) |

- Root `package.json`: `"dev": "mprocs"` (replacing `turbo dev`).
- `.env` (dev): `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5532`,
  `POSTGRES_SCHEMA=tickets_dev`.
- `db:studio`: a unified `drizzle.studio.config.ts` (items-core pattern) with
  `schemaFilter: [POSTGRES_SCHEMA]` and env-based `dbCredentials`, launched via the
  existing `packages/db` script. Root `db:studio` passthrough already added.

The dev API now runs as a host `tsx watch` process (hot reload), so the deployed
container's internal `:4600` no longer collides with anything on the host.

## Verification

- **Schema switch:** `pnpm db:migrate` + `db:seed` against a scratch `tickets_dev`;
  confirm tables + `__drizzle_migrations` land in `tickets_dev` (`\dt tickets_dev.*`).
- **Prod cutover:** dry-run the guarded script on a copy of the prod volume; assert 18
  tables + journal end up in `tickets`, `public` is empty, and a follow-up `db:migrate`
  is a no-op.
- **Combined container:** `docker compose up --build`; `curl :4610/` (SPA),
  `:4610/api/…` (API JSON), `:4610/studio/` (Studio UI); confirm API and Studio are
  **not** reachable on any host port other than via nginx.
- **Studio access lock:** confirm `/studio/` is denied from a non-allowed origin.
- **Dev flow:** `pnpm dev` brings up the mprocs dashboard; web at `:4620` talks to the
  host API at `:4600` against `tickets_dev`; studio pane shows `tickets_dev` tables.
- **Regression:** `pnpm typecheck`, `pnpm --filter @tickets/web test`, and the API
  integration suite (`apps/api/src/app.test.ts`) all pass.

## Risks / notes

- **Studio-behind-nginx is the hard part** (medialib used Caddy's simpler proxy DSL +
  forward-auth). Isolated build + decision-#6 fallback mitigate this.
- **`/studio` exposes a live DB browser.** Must be locked down in prod (decision #5).
  Dev studio is host-local and unaffected.
- **Integration test is isolated.** `app.test.ts` builds its own raw client + ephemeral
  DB and migrates into `public` with default options — it does *not* go through
  `createDbClient`, so it is unaffected by `POSTGRES_SCHEMA`. Verified by re-running the
  suite (not by assumption).
- **Port `5532` conflict.** Publishing `tickets-postgres` on `5532` collides with a
  running `items-core-postgres-1`. Cutover expectation: stop the latter. (Alternative
  `5533` if both must coexist — not chosen.)
- **`mprocs` install** goes through the `add-package` skill (new dependency).

## Files touched (anticipated)

- `packages/db/src/environment.ts` — add `schema` knob.
- `packages/db/src/client.ts` — `search_path` connection option.
- `packages/db/src/migrate.ts` — `CREATE SCHEMA IF NOT EXISTS` + `migrationsSchema`.
- `drizzle.studio.config.ts` (new, repo root) — unified studio config, `schemaFilter`.
- `packages/db/package.json` — `db:studio` uses the studio config; keep root passthrough.
- `Dockerfile` — new combined `app` target (nginx + supervisor + node).
- `docker/nginx.conf` — `/api` + `/studio` routing under one server.
- `docker/supervisord.conf` (new) — nginx / api / studio programs.
- `docker/entrypoint.sh` (new) — cutover-or-noop + migrate + exec supervisord.
- `scripts/cutover-public-to-tickets.sql` (new, guarded) — one-time rename.
- `docker-compose.yml` — collapse to `postgres` (published) + `app`.
- `mprocs.yaml` (new, repo root) — dev panes.
- `package.json` (root) — `"dev": "mprocs"`; add `mprocs` devDependency.
- `.env` / `.env.example` — `POSTGRES_SCHEMA`, port docs.
