# Schema Namespacing Design — nothing in `public`

**Status:** approved design, ready for planning
**Branch:** work on `main` (user directive)
**Date:** 2026-07-18

## Goal

Move all 22 items-platform tables out of the `public` Postgres schema into named
schemas, so none of our tables live in `public`. Fold this into SP4c **before**
the production cutover, so prod is built fresh into the final layout in one
migration (no `ALTER … SET SCHEMA` on live data, no second prod migration).

## Context that shapes the design

- **The SSOT model tracks schema.** `EerEntity.schema` / `EerEnum.schema` exist,
  and `packages/db/src/schema/model-conformance.test.ts` enforces qualified
  identity (`schema.name`) in BOTH directions against
  `apps/eer/models/items-platform.json`. Every table move must be mirrored in the
  model JSON; the conformance test is the gate that prevents drift.
- **Raw SQL references bare table names** in hot spots that break when tables
  leave `public` unless the connection `search_path` covers the new schemas:
  `apps/api/src/outbox/worker.ts` (`UPDATE/FROM outbox`),
  `apps/api/src/command/item/helpers.ts` (`FROM projects`), and much of
  `packages/db/src/import/verify-import.ts` (`FROM item_values`, `JOIN fields`,
  `JOIN options`, `FROM items`, `FROM comments`), plus raw `UPDATE items` /
  `UPDATE comments` in `import-legacy.ts`.
- **`core`/`terminal`/`agent` schemas already exist** (`schemas.ts`).
  `core.workdirs`, `terminal.{sessions,output}`, `agent.{sessions,messages,
  permission_requests,agents}` stay as-is.
- **SP4c cutover is built but NOT run** — prod is still old-schema. This reorg
  rides into prod through the cutover's fresh `db:import`.

## Locked decisions

1. **Partition** (see table below); `terminal`/`agent` unchanged.
2. **Mechanism: schema-qualify the drizzle definitions + set `search_path`** on
   the app/importer connection — NOT hunt-and-qualify every raw query.
3. **No `ALTER … SET SCHEMA`.** Redefine the schema, regenerate the drizzle
   baseline; the importer builds prod fresh into the new layout at cutover.
4. **Fold into SP4c before the cutover.**

## Target partition

| schema | tables |
|---|---|
| `core` | `users`, `workdirs`, `projects` |
| `structure` | `schemes`, `item_types`, `item_type_child_types`, `fields`, `item_type_fields`, `option_sets`, `options`, `option_transitions`, `link_types`, `link_type_target_types`, `views` |
| `records` | `items`, `item_values`, `item_links`, `comments`, `comment_reactions` |
| `history` | `commands`, `events`, `outbox`, `item_activity` |
| `terminal` | `sessions`, `output` (unchanged) |
| `agent` | `sessions`, `messages`, `permission_requests`, `agents` (unchanged) |

After this, `public` holds **none of our tables** (Postgres keeps `public`
existing for extensions). Rationale for the judgment calls: `users` → `core`
(shared identity referenced by records + agent + structure); `projects` →
`core` (a platform-level entity reusable outside the items/tickets domain —
workdirs, terminal + agent sessions all attach to a project); `views` →
`structure` (saved configuration).

## Mechanism (detail)

- **`packages/db/src/schema/schemas.ts`**: add
  `export const structureSchema = pgSchema('structure')`, `recordsSchema`,
  `historySchema`.
- **Every table file**: `pgTable('x', …)` → `<schema>.table('x', …)`. Enums that
  belong to a namespaced table move with it (declare via the schema object where
  applicable; conformance carries enum schema). Cross-schema FKs
  (`records.items.type_id → structure.item_types.id`,
  `records.items.created_by → core.users.id`, `history.events.project_id →
  structure.projects.id`, etc.) are native Postgres + drizzle references.
- **`apps/eer/models/items-platform.json`**: set each entity's `schema` to its
  target schema; update enum `schema` where an enum moves. The conformance test
  must pass in both directions.
- **`packages/db/src/client.ts` (`createDbClient`)**: set the connection
  `search_path` to `core, structure, records, history, public` (via postgres-js
  `connection: { search_path: … }` or `options: '-c search_path=…'`). This makes
  every bare-table raw SQL query resolve without edits, and drizzle's qualified
  queries continue to work. Table names are unique across schemas, so there is no
  ambiguity. The legacy client (`createLegacyClient`, reads OLD-schema
  `tickets_legacy`) is unchanged and stays on `public`.
- **`packages/db/drizzle`**: regenerate the baseline so it emits `CREATE SCHEMA`
  for `structure`/`records`/`history` and schema-qualified `CREATE TABLE`s. Since
  dev DBs rebuild from scratch and prod is built fresh at cutover, no data-move
  migration is authored.
- **`scripts/cutover.sh` preflight**: the `SELECT count(*) FROM events …` runs
  via `docker exec psql` (no `search_path`), so qualify it to
  `FROM history.events`.
- **Schema-guard is unaffected**: `schema-guard.ts` scans all non-system schemas,
  so the `item_values` marker (now in `records`) is still found; the `statuses`
  old-marker is still in old-schema `public`. Classifier logic unchanged.

## Impact / blast radius

- ~22 drizzle table files (mechanical), `schemas.ts`, `createDbClient`
  (search_path), `apps/eer/models/items-platform.json` (~22 entities), the
  regenerated drizzle baseline, one `cutover.sh` preflight line.
- App read/write paths go through drizzle → transparent. Raw SQL covered by
  `search_path`. No API route or web change expected.

## Testing

- **`model-conformance` (both directions)** — the hard gate; every table's
  `schema.name` identity must match between drizzle and the model JSON.
- **Full suites**: `@tickets/db`, `@tickets/api`, `@tickets/web`, `@tickets/eer`;
  root `pnpm typecheck`.
- **eer seed-equivalence / round-trip**: entity identities may gain a schema
  component; reconcile the digests so the tests still prove shape-preservation.
- **From-scratch rebuild + import**: drop → `db:migrate` → `db:import` →
  `db:verify-import` against a scratch DB (`tickets_rehearsal` or a dev DB) must
  report **PASS: 0 differences** in the new layout, proving the importer lands
  every table in its schema correctly.
- **A cutover `--rehearsal` dry-run** confirms the qualified preflight resolves.

## SP4c interaction

This reorg lands on `main` before the SP4c live cutover runs. The only cutover
artifacts it touches are the regenerated baseline (already rebuilt-from-scratch
per SP4c) and the one qualified preflight line. The cutover runbook, schema-guard,
and entrypoint guard are otherwise unchanged. Net: when the cutover runs, prod is
built directly into the namespaced layout.

## Out of scope

- No behavioral/API/UI change — pure namespacing.
- No `terminal`/`agent` changes.
- The live cutover itself (still human-executed under SP4c).

## Types / glossary

- **`structure` / `records` / `history`** — new Postgres schemas created by the
  regenerated baseline.
- **search_path** — the Postgres client setting that lets unqualified table names
  resolve across our schemas; set on `createDbClient`.
- **model-conformance** — the test diffing drizzle vs `items-platform.json` in
  both directions, now keyed on `schema.name`.
- **marker tables** — `item_values` (new, now in `records`) / `statuses` (old, in
  `public`); the cutover schema-guard keys on their table names regardless of
  schema.
