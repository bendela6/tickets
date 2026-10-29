# tickets

A ticket tracker for several projects. Nothing on a ticket is hard-coded: its fields, types,
statuses (with their workflow), views and link types are all data in Postgres.

## Stack

A pnpm + turbo monorepo on Node 20+.

| Package                              | What                                                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| [apps/api](apps/api/README.md)       | The HTTP API: Fastify on `:4600`.                                |
| [apps/web](apps/web/README.md)       | The web app: React 19 and tilewise's components, `:4620` in dev. |
| [packages/db](packages/db/README.md) | The schema, migrations and seeds, and project export and delete. |

## How it fits

- The browser loads apps/web, which calls apps/api under `/api`.
- apps/web never touches Postgres: apps/api reads and writes it, through packages/db.
- After each write, the API's outbox worker updates the activity feed and runs the automations.

## Getting started

```sh
docker compose up -d postgres   # Postgres on 127.0.0.1:5532, with tickets_dev and tickets_test
cp .env.example .env            # points at the tickets_dev database
pnpm install
pnpm db:migrate
pnpm dev                        # api, web and a typecheck watcher, in mprocs
```

To add an empty project, see `db:seed` in [packages/db](packages/db/README.md#scripts).

## Commands

| Command          | Does                            |
| ---------------- | ------------------------------- |
| `pnpm typecheck` | Type-checks every package.      |
| `pnpm test`      | Runs every package's tests.     |
| `pnpm build`     | Builds the web app.             |
| `pnpm format`    | Formats the repo with Prettier. |
