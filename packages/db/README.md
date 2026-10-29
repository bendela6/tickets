# @tickets/db

tickets' database: the drizzle schema and its migrations, the seeds, and scripts that export and
delete projects.

## Use

```ts
import { createDbClient } from '@tickets/db';

const { db, sql } = createDbClient(); // connects with the POSTGRES_* variables below
```

It also exports every table, `migrateDatabase` and the seeds (`seedProject`, `ensureScheme`,
`softwareScheme`, `planScheme`, `ensureUser`).

## Schema

Every table lives in one of four Postgres schemas, none in `public`:

| Schema      | Holds                                                           |
| ----------- | --------------------------------------------------------------- |
| `core`      | Users and projects.                                             |
| `structure` | The schemes: item types, fields, options, link types and views. |
| `records`   | Item data: items, values, links, comments, attachments.         |
| `history`   | The command and event log, the outbox and the activity feed.    |

`src/schema/items-platform.json` is the model the tables must match. Migrations are the SQL files
in `drizzle/`.

## Scripts

```sh
pnpm db:migrate                                      # apply new migrations
pnpm db:generate                                     # write a migration for a schema change
pnpm db:seed <key> <name> <PREFIX> [software|plan]   # add an empty project
pnpm --filter @tickets/db db:export --out <dir> [--name '{date}-{key}.json'] <project>...
pnpm --filter @tickets/db db:delete-project --backup <file> [--yes] <project>...
pnpm --filter @tickets/db test                       # against tickets_test, which it migrates first
```

- `<project>` is a project key (`items-core`) or an item prefix (`TASK`).
- `db:export` writes one JSON file per project through a read-only session, then checks each file.
- `db:delete-project` needs each project's export as its `--backup`. Without `--yes` it only shows
  what it would delete. It refuses the `tickets` database unless given
  `--delete-from-the-production-database`.

## Configuration

Read from the environment, else from the nearest `.env` above where it runs.

| Variable            | Default     |
| ------------------- | ----------- |
| `POSTGRES_HOST`     | `localhost` |
| `POSTGRES_PORT`     | `5432`      |
| `POSTGRES_USER`     | `postgres`  |
| `POSTGRES_PASSWORD` | `postgres`  |
| `POSTGRES_DATABASE` | `tickets`   |

The root `.env.example` points at `tickets_dev` on port 5532. Tests always use `tickets_test`.

## Schema tools

- `src/schema/introspect` reads any database's tables, keys, indexes and enums from its catalog.
  The API serves it at `/api/schema` for the web's `/schema` page.
- `src/schema/drizzle-roundtrip` turns the schema into a drizzle module and back; its gate test
  proves nothing is lost on the way.

## Used by

[apps/api](../../apps/api/README.md).
