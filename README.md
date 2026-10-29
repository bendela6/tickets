# tickets

A ticket tracker for several projects. Nothing on a ticket is hard-coded: its fields, types,
statuses (with their workflow), views and link types are all data in Postgres.

## Stack

A pnpm + turbo monorepo on Node 20+.

| Package       | What                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/api`    | Fastify API on `:4600`, the only thing that touches Postgres. Routes are in `src/routes`, one file per area. |
| `apps/web`    | React 19, TanStack Router and Query, Tailwind v4, UI from `@tilewise/*`. Runs on `:4620` in dev.             |
| `packages/db` | Drizzle schema, migrations, seed, project export and delete.                                                 |

## Getting started

```sh
docker compose up -d postgres   # Postgres on 127.0.0.1:5532, with tickets_dev and tickets_test
cp .env.example .env            # points at the tickets_dev database
pnpm install
pnpm db:migrate
pnpm dev                        # api, web and a typecheck watcher, in mprocs
```

To add an empty project: `pnpm db:seed <key> <name> <PREFIX> [software|plan]`.

## Commands

| Command          | Does                            |
| ---------------- | ------------------------------- |
| `pnpm typecheck` | Type-checks every package.      |
| `pnpm test`      | Runs every package's tests.     |
| `pnpm build`     | Builds the web app.             |
| `pnpm format`    | Formats the repo with Prettier. |
