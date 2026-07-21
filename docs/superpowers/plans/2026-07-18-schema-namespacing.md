# Schema Namespacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 22 items-platform tables (and their enums) out of the `public` Postgres schema into `core`/`structure`/`records`/`history`, so none of our tables or types live in `public`.

**Architecture:** Schema-qualify the drizzle table/enum definitions, mirror each move in the eer SSOT model JSON (the both-directions conformance test is the hard gate), set the client `search_path` so bare-table raw SQL keeps resolving, then regenerate the drizzle baseline (collapse to one) and prove it with a from-scratch migrate → import → `verify-import` 0-diff. No `ALTER … SET SCHEMA` — prod is built fresh at the SP4c cutover.

**Tech Stack:** drizzle-orm + drizzle-kit (postgresql), postgres-js, vitest, `@tickets/db` + `apps/eer` (SSOT model + conformance).

## Global Constraints

- **Target partition (exact):**
  - `core`: `users`, `workdirs` (workdirs already there)
  - `structure`: `schemes`, `projects`, `item_types`, `item_type_child_types`, `fields`, `item_type_fields`, `option_sets`, `options`, `option_transitions`, `link_types`, `link_type_target_types`, `views`
  - `records`: `items`, `item_values`, `item_links`, `comments`, `comment_reactions`
  - `history`: `commands`, `events`, `outbox`, `item_activity`
  - `terminal`, `agent`: UNCHANGED.
- **Enums move with their owning schema:** `user_kind` → `core`; `status_kind`, `field_type` → `structure`. (`runner_kind`=core, the `session_status`/`permission_*` enums=terminal/agent are already namespaced.)
- **Mechanism is schema-qualify + `search_path`** — do NOT hand-qualify every raw SQL query. `search_path` = `core, structure, records, history, public`.
- **No `ALTER … SET SCHEMA`.** Regenerate the drizzle baseline; the importer builds prod fresh at cutover.
- **The eer model JSON (`apps/eer/models/items-platform.json`) and drizzle must agree** — `model-conformance.test.ts` checks both directions on `schema.name` identity. It is the gate for the namespacing task.
- **`public` keeps none of our tables or enum types** afterward (Postgres retains the empty `public` schema itself, which is fine).
- Work directly on `main` in the primary worktree. One commit per task.

Model-JSON encoding (verified): a namespaced entity has `"id": "<schema>.<table>"` AND `"schema": "<schema>"`; a public entity has a bare `"id": "<table>"` and no `schema` key. Enums likewise carry a `"schema"` field (null for public). Every relationship references entities by their `id` string, so renaming an entity id requires updating every relationship endpoint that points at it.

---

## File Structure

- `packages/db/src/schema/schemas.ts` (modify) — add `structureSchema`, `recordsSchema`, `historySchema`.
- `packages/db/src/schema/enums.ts` (modify) — namespace `user_kind`/`status_kind`/`field_type`.
- `packages/db/src/schema/*.ts` — the 22 table files: `pgTable('x', …)` → `<schema>.table('x', …)`.
- `apps/eer/models/items-platform.json` (modify) — entity `id`+`schema`, relationship endpoints, enum `schema`.
- `packages/db/src/client.ts` (modify) — set `search_path` on the connection.
- `scripts/cutover.sh` (modify) — qualify the preflight `events` reference to `history.events`.
- `packages/db/drizzle/*` (regenerate) — collapse to a single namespaced baseline.

---

## Task 1: Namespace the drizzle schema + the SSOT model

Move every table and owned enum into its target schema in BOTH the drizzle definitions and the model JSON, in one coordinated change. Gate is conformance + typecheck (DB-backed suites are intentionally deferred to Task 3, after the baseline is regenerated and `tickets_test` rebuilt).

**Files:**
- Modify: `packages/db/src/schema/schemas.ts`, `packages/db/src/schema/enums.ts`, and each of the 22 table files under `packages/db/src/schema/`
- Modify: `apps/eer/models/items-platform.json`
- Test (gate): `packages/db/src/schema/model-conformance.test.ts` (existing — do not weaken it)

**Interfaces:**
- Produces: `structureSchema`, `recordsSchema`, `historySchema` (drizzle `PgSchema`) exported from `schemas.ts`, alongside the existing `coreSchema`.
- Produces: every table object (`items`, `events`, …) unchanged in name/exports — only its underlying schema changes — so all downstream imports keep working.

- [ ] **Step 1: Add the schema objects**

In `packages/db/src/schema/schemas.ts`, after `coreSchema`:

```ts
export const structureSchema = pgSchema('structure');
export const recordsSchema = pgSchema('records');
export const historySchema = pgSchema('history');
```

- [ ] **Step 2: Namespace the owned enums**

In `packages/db/src/schema/enums.ts`, import the schema objects and change the three public enums from `pgEnum('name', [...])` to the schema form. Pattern (apply to all three):

```ts
// before: export const userKindEnum = pgEnum('user_kind', ['human', 'agent']);
import { coreSchema, structureSchema } from './schemas';

export const userKindEnum = coreSchema.enum('user_kind', ['human', 'agent']);
export const statusKindEnum = structureSchema.enum('status_kind', ['todo', 'active', 'blocked', 'done', 'dropped']);
export const fieldTypeEnum = structureSchema.enum('field_type', ['string', 'number', 'boolean', 'date', 'datetime', 'option', 'user', 'json']);
```

Keep the exact enum value lists as they currently are in `enums.ts` — copy them verbatim; only the constructor (`pgEnum` → `<schema>.enum`) changes.

- [ ] **Step 3: Namespace every table file**

For each table file, import its target schema object from `./schemas` and change `pgTable('<name>', …)` to `<schemaObject>.table('<name>', …)`. The `<name>` string, the columns, the `(t) => [...]` extras block, and all `.references(() => other)` FKs stay exactly as they are — cross-schema FKs are valid. Apply per this mapping:

| schema object | files (table) |
|---|---|
| `coreSchema` | `users.ts` (users) — `workdirs.ts` already done |
| `structureSchema` | `schemes.ts`, `projects.ts`, `item-types.ts`, `item-type-child-types.ts`, `fields.ts`, `item-type-fields.ts`, `option-sets.ts`, `options.ts`, `option-transitions.ts`, `link-types.ts`, `link-type-target-types.ts`, `views.ts` |
| `recordsSchema` | `items.ts`, `item-values.ts`, `item-links.ts`, `comments.ts`, `comment-reactions.ts` |
| `historySchema` | `commands.ts`, `events.ts`, `outbox.ts`, `item-activity.ts` |

Concrete example — `items.ts`:

```ts
// change the import + the constructor; leave columns/extras/FKs untouched
import { index, integer, serial, timestamp, unique, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { itemTypes } from './item-types';
import { projects } from './projects';
import { users } from './users';
import { recordsSchema } from './schemas';

export const items = recordsSchema.table(
  'items',
  { /* …unchanged columns… */ },
  (t) => [ /* …unchanged unique/index… */ ],
);
```

Follow the exact same edit for every file in the mapping. Use the `pgTable` reference form only if a file has no extras block; the constructor swap is identical either way.

- [ ] **Step 4: Update the model JSON entities + enums**

In `apps/eer/models/items-platform.json`, for each entity being moved:
1. change `"id": "<table>"` → `"id": "<schema>.<table>"`
2. add `"schema": "<schema>"`

For each moved enum in the model's `enums` array, set its `"schema"` (e.g. `user_kind` → `"core"`, `status_kind`/`field_type` → `"structure"`).

Then update EVERY relationship whose `source` or `target` equals a moved entity's old id to its new qualified id (e.g. a relationship `{"source":"items","target":"item_types",…}` becomes `{"source":"records.items","target":"structure.item_types",…}`). Search the file for each old bare id used as an endpoint and requalify it. Follow the exact same `id` scheme already used by `core.workdirs`, `terminal.sessions`, etc.

- [ ] **Step 5: Run the conformance gate**

Run: `pnpm --filter @tickets/db exec vitest run src/schema/model-conformance.test.ts`
Expected: PASS. The test diffs drizzle vs the model in both directions on `schema.name`; any table/enum whose schema disagrees between the two sides fails here. Fix mismatches until green. Do NOT edit the test to pass.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: 5/5 successful. (Cross-schema `.references()` typecheck fine; downstream imports are unchanged because the exported table names are unchanged.)

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema apps/eer/models/items-platform.json
git commit -m "refactor(db): namespace all tables + owned enums into core/structure/records/history"
```

Note: `@tickets/db` / `@tickets/api` DB-backed tests are expected to be RED after this commit (the drizzle objects now point at schemas that `tickets_test` does not have yet). They go green in Task 3 after the baseline is regenerated and `tickets_test` rebuilt. Do not attempt to run or "fix" them here.

---

## Task 2: Client search_path + cutover preflight qualification

**Files:**
- Modify: `packages/db/src/client.ts`
- Modify: `scripts/cutover.sh`

**Interfaces:**
- Consumes: nothing new. Produces: a `createDbClient` whose connections resolve unqualified table names across our schemas.

- [ ] **Step 1: Set search_path on the client connection**

In `packages/db/src/client.ts`, add the `connection` startup parameter so unqualified names resolve across our schemas (drizzle's own queries are schema-qualified and unaffected):

```ts
export function createDbClient({ max = 10 }: { max?: number } = {}) {
  const sql = postgres(connectionUrl, {
    max,
    connection: { search_path: 'core, structure, records, history, public' },
  });
  const db = drizzle(sql, { schema });
  return { db, sql };
}
```

- [ ] **Step 2: Qualify the cutover preflight**

In `scripts/cutover.sh`, the preflight query runs via `docker exec psql` (no search_path), so qualify the table. Change the `NULLS=` query's `FROM events` to `FROM history.events`:

```bash
    "SELECT count(*) FROM history.events WHERE aggregate_type='item' AND project_id IS NULL" $TARGET)"
```

- [ ] **Step 3: Verify script syntax + typecheck**

Run: `bash -n scripts/cutover.sh` → exit 0, no output.
Run: `pnpm typecheck` → 5/5 successful.
(The runtime effect of search_path is proven in Task 3 against the rebuilt DB.)

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/client.ts scripts/cutover.sh
git commit -m "feat(db): search_path over the new schemas; cutover preflight uses history.events"
```

---

## Task 3: Regenerate the baseline and prove the whole thing

Collapse the drizzle migrations to a single namespaced baseline, rebuild the test DB from it, and prove correctness end-to-end: full suites green + a from-scratch import that `verify-import` reports as 0-diff in the new layout.

**Files:**
- Regenerate: `packages/db/drizzle/*.sql`, `packages/db/drizzle/meta/*`

**Interfaces:**
- Consumes: the namespaced schema from Tasks 1–2. Produces: one baseline migration that `CREATE SCHEMA`s `structure`/`records`/`history` and creates every table schema-qualified.

- [ ] **Step 1: Collapse + regenerate the baseline**

The existing baseline is a hand-written chain (`0000_*`, `0001_*`). Because no live DB needs its history preserved (dev rebuilds from scratch; prod is built fresh at cutover), collapse to one generated baseline:

```bash
cd packages/db
rm drizzle/*.sql
rm -rf drizzle/meta
pnpm exec drizzle-kit generate --name items_platform_namespaced
cd ../..
```

Expected: a single `drizzle/0000_items_platform_namespaced.sql` containing `CREATE SCHEMA "structure"` / `"records"` / `"history"`, `CREATE TYPE "core".…`/`"structure".…` for the moved enums, and schema-qualified `CREATE TABLE "records"."items"` etc. Open the file and confirm it has no `public.items`/`public.events`/`public.item_values` and that `CREATE SCHEMA` lines exist for the three new schemas.

- [ ] **Step 2: Rebuild `tickets_test` from the new baseline**

```bash
docker exec tickets-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS tickets_test;"
docker exec tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_test;"
POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/db db:migrate
```

Expected: `migrations applied`. Then confirm nothing of ours is in public:

```bash
docker exec tickets-postgres-1 psql -U postgres -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" tickets_test
```

Expected: `0`.

- [ ] **Step 3: Confirm search_path resolves (proves Task 2 at runtime)**

```bash
docker exec tickets-postgres-1 psql -U postgres -tAc "SHOW search_path" tickets_test
```

This shows the DB default; the app path is set by `createDbClient`. Verify the app path by running the db suite (next step) — a bare-table query in `verify-import`/`worker` failing would surface a search_path problem.

- [ ] **Step 4: Full suites**

```bash
pnpm --filter @tickets/db test
pnpm --filter @tickets/api test
pnpm --filter @tickets/web test
pnpm --filter @tickets/eer test
pnpm typecheck
```

Expected: all green (db, api, web, eer, typecheck 5/5). The eer seed-equivalence / round-trip tests exercise the model's new schema fields; if a digest now needs the schema component, reconcile the test's expectation to include it (do not weaken what it asserts — add the schema dimension the same way `core.workdirs` is already represented).

- [ ] **Step 5: Prove the importer lands correctly across schemas (0-diff)**

Build a scratch DB from a fresh legacy source and verify (this reuses the SP4c machinery; never targets a DB named `tickets`):

```bash
# restore an existing legacy dump into tickets_legacy first if needed, then:
docker exec tickets-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS tickets_ns_check;"
docker exec tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_ns_check;"
POSTGRES_DATABASE=tickets_ns_check pnpm --filter @tickets/db db:migrate
POSTGRES_DATABASE=tickets_ns_check pnpm --filter @tickets/db db:import
POSTGRES_DATABASE=tickets_ns_check pnpm --filter @tickets/db db:verify-import
```

Expected: `db:import` succeeds and `db:verify-import` prints `PASS: 0 differences, all counts match`. This proves every table (across all four schemas) is created and populated correctly through the new baseline + search_path. (If no `tickets_legacy` exists in the dev environment, note it and run `db:restore-legacy` with an available dump first; if none is available, report that the 0-diff proof needs a legacy dump and stop — do not fabricate a pass.)

- [ ] **Step 6: Commit**

```bash
git add packages/db/drizzle
git commit -m "chore(db): collapse to a single namespaced baseline; rebuild + import verified 0-diff"
```

---

## Self-Review

**Spec coverage:**
- Partition (core/structure/records/history) → Task 1 mapping + Global Constraints. ✅
- Enums move with schema → Task 1 Step 2. ✅
- Model JSON mirrors moves; conformance both-directions gate → Task 1 Steps 4–5. ✅
- search_path mechanism (not hand-qualify) → Task 2 Step 1. ✅
- cutover.sh preflight → `history.events` → Task 2 Step 2. ✅
- No ALTER SET SCHEMA; regenerate baseline; prod fresh → Task 3 Step 1. ✅
- schema-guard unaffected → no task needed (it scans all schemas; `item_values` still found) — verified in the spec; Task 3 Step 2's "0 tables in public" + suites confirm nothing regressed. ✅
- Testing: conformance + full suites + from-scratch import 0-diff → Tasks 1 & 3. ✅
- terminal/agent unchanged → not touched by any task. ✅

**Placeholder scan:** table edits are specified as one exact transform + the complete 22-file mapping (a mechanical rename, not a TODO); every command has an expected result. No TBD/handwaving. ✅

**Type consistency:** exported table/enum names are unchanged (only their schema changes), so all downstream imports and every later task refer to the same `items`/`events`/`userKindEnum` identifiers. `structureSchema`/`recordsSchema`/`historySchema` names are used identically in Steps 1 and 3. ✅
