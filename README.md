# tickets

Multi-project ticket tracker with fully dynamic fields. Everything user-visible
on a ticket (title, status, severity, epic, …) is a field definition + typed
value in Postgres; ticket types, statuses (with a workflow graph), views, and
link types are all data.

## Layout

| Package       | What                                                              |
| ------------- | ----------------------------------------------------------------- |
| `packages/db` | drizzle schema, migrations, seed factory, project export/delete   |
| `apps/api`    | Fastify HTTP API (port 4600) — the only thing that touches the DB |
| `apps/web`    | React dashboard (port 4610) — views, table, drawer, dialog        |

## Quick start

```sh
cp .env.example .env          # postgres on 127.0.0.1:5532, db "tickets_dev"
pnpm install
pnpm db:migrate               # apply schema
pnpm dev                      # mprocs: api on 4600 + web on 4620 + watchers
```

New empty project: `pnpm db:seed <key> <name> <PREFIX> [software|plan]` (the scheme, `software` by default) or `POST /api/projects`.

## Run in Docker

```sh
docker compose up -d --build
```

Two services: `postgres` (17-alpine, own named volume `tickets-pgdata`,
published loopback-only on `127.0.0.1:5532`, holding both the `tickets`
(prod) and `tickets_dev` (dev) databases) and `app` — a single container
running nginx on [http://127.0.0.1:4610](http://127.0.0.1:4610) that serves
the built web SPA and reverse-proxies `/api` to an internal node API
(`127.0.0.1:4600`, not published to the host), plus a self-hosted DB browser
(pgweb) at [http://localhost:4610/studio](http://localhost:4610/studio) (same
port; baked into the image, works offline). `pnpm dev` (mprocs) uses its
own ports (api `:4600`, web `:4620`) against `tickets_dev` on the same
postgres, so dev and the deployed container can run side by side.

- Inspect the DB: `docker exec -it tickets-postgres-1 psql -U postgres -d tickets` (or `-d tickets_dev`)
- Logs: `docker compose logs -f app`
- Stop: `docker compose down` (add `-v` to also drop the data volume)

## HTTP API

Fastify on `:4600`, the only process that touches Postgres. Its routes are in
`apps/api/src/routes/`, one file per area.
