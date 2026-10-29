# @tickets/db

- Commands: `pnpm --filter @tickets/db test`, `… typecheck`, one file:
  `pnpm --filter @tickets/db test src/seed/seed-scheme.test.ts`.
- Change the schema in two places together: the model in `src/schema/items-platform.json` and the
  drizzle table. `model-conformance.test.ts` fails on any difference, either way.
- Put every table in one of the schemas in `src/schema/schemas.ts`, never `public`, and list it in
  `src/schema/registry.ts`.
- Export a new enum from `src/schema/index.ts`: drizzle leaves out the `CREATE TYPE` for an enum it
  can't see there.
- After a schema change run `pnpm db:generate` for a new migration. Never edit a migration that is on
  main: it has already run in production and won't run again.
- Add a new table to `TABLES` in `apps/api/src/test/db.ts` too. The API's tests empty those tables
  before each test, and a missing one leaks rows from one test into the next.
