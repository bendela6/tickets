# Items Platform — Schema Rebuild + Legacy Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `ticket*` schema with the 22-table items platform from `apps/eer/models/items-platform.json`, in one migration, and import all 635 live items into it with a verified, lossless import.

**Architecture:** The EER model is enriched to hold the complete DDL (nullability, uniques, checks, indexes, enums — its format already supports all of it). Drizzle is hand-written to match, and a conformance test diffs `describeSchema()` against the model in both directions so the two cannot drift. The old migration history is deleted and one fresh migration generated. A legacy importer then reads a restore of the pre-rebuild backup and writes the new schema, with a verifier that diffs logical item state old-vs-new.

**Tech Stack:** TypeScript · drizzle-orm 0.45 + drizzle-kit 0.31 · postgres-js · vitest 4 · Postgres 17 · pnpm workspace (`@tickets/db`)

Spec: [`2026-07-14-items-platform-schema-and-import-design.md`](../specs/2026-07-14-items-platform-schema-and-import-design.md)

## Global Constraints

- **This plan touches `packages/db/**` and `apps/eer/models/items-platform.json` ONLY.** A parallel workstream owns `apps/eer/src/**` (the eer round-trip plan). Do not edit its files.
- **From Task 4 onward, `apps/api`, `apps/web` and `apps/mcp` DO NOT COMPILE.** This is expected and correct — they are ported in sub-projects 2–4. Root `pnpm typecheck` and `pnpm build` WILL FAIL. **The gate for every task in this plan is `pnpm --filter @tickets/db typecheck` and `pnpm --filter @tickets/db test`, never the root ones.**
- **All database work targets `tickets_dev`.** The live app runs on the `tickets` database and must never be touched. Every command that reaches postgres must set `POSTGRES_DATABASE=tickets_dev`. The one exception is Task 8, which creates and populates a throwaway `tickets_legacy`.
- **Postgres runs in docker** as container `tickets-postgres-1`, published on `127.0.0.1:5532`, user/password `postgres`/`postgres`.
- **The backup already exists** at `backups/tickets-2026-07-14.dump` (custom format) and `backups/tickets-2026-07-14.sql` (plain). `backups/` is gitignored. Do not delete it.
- **Naming:** SQL is `snake_case`, drizzle exports are `camelCase` (`itemValues`, `optionSets`, `itemTypeFields`). Every table's drizzle export goes in `allTables` (`registry.ts`) and in exactly one `SCHEMA_GROUPS` entry.
- **No `status` field type, no `statuses` table.** A workflow status is an `option` field. Lifecycle kind lives on `options.kind` (a real nullable enum column — this is the model amendment in Task 1).
- **TDD:** every task writes its failing test first, watches it fail, then implements. Commit at the end of every task.

---

## File Structure

**Created** in `packages/db/src/schema/` — one file per table, mirroring the model's four groups:

| Group | Files |
| --- | --- |
| — | `enums.ts` (rewritten: `user_kind`, `status_kind`, `field_type`) |
| WORKSPACE | `users.ts` · `projects.ts` · `views.ts` |
| STRUCTURE | `schemes.ts` · `item-types.ts` · `item-type-child-types.ts` · `item-type-fields.ts` · `fields.ts` · `option-sets.ts` · `options.ts` · `option-transitions.ts` · `link-types.ts` · `link-type-target-types.ts` |
| RECORDS | `items.ts` · `item-values.ts` · `comments.ts` · `comment-reactions.ts` · `item-links.ts` |
| HISTORY | `events.ts` · `commands.ts` · `outbox.ts` · `item-activity.ts` |

**Deleted** from `packages/db/src/schema/`: `tickets.ts` · `ticket-values.ts` · `ticket-events.ts` · `ticket-types.ts` · `ticket-type-child-types.ts` · `ticket-links.ts` · `statuses.ts` · `status-transitions.ts` · `field-options.ts`

**Rewritten:** `registry.ts` · `schema-groups.ts` · `index.ts` · `describe-schema.ts` (gains checks + indexes + enums) · `src/seed/*`

**Created** in `packages/db/src/import/` — the importer, one file per responsibility:

| File | Responsibility |
| --- | --- |
| `legacy-client.ts` | a raw postgres-js client pointed at `tickets_legacy` (no drizzle — the old tables' schema is gone) |
| `read-legacy.ts` | typed reads of the 15 old tables |
| `kind-map.ts` | legacy event kind → new event kind |
| `map-structure.ts` | the pure old→new structure transform (46 fields → 15 + 46 placements; 34 statuses → 12 options; option sets) and the id maps |
| `import-legacy.ts` | orchestrator; writes the new schema in dependency order |
| `verify-import.ts` | reads both DBs, diffs logical item state, asserts counts |

**Deleted:** `packages/db/src/migrate-fields-links/` (a one-off migration for the type-owned-fields work; obsolete once the schema is rebuilt).

---

## Task 1: The model holds the whole DDL

The model file is entity/column/FK-level; its format is not. Enrich the file so it carries the complete schema, then the code can be checked against it.

**Files:**
- Modify: `apps/eer/models/items-platform.json`
- Create: `packages/db/src/schema/model.ts` (loader + types)
- Test: `packages/db/src/schema/model.test.ts`

**Interfaces:**
- Produces: `loadModel(): EerModel` from `packages/db/src/schema/model.ts`, and the types `EerModel`, `EerEntity`, `EerColumn`, `EerConstraint`, `EerIndex`, `EerEnum` — consumed by Task 3's conformance test.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/model.test.ts`:

```ts
// packages/db/src/schema/model.test.ts
import { describe, expect, it } from 'vitest';
import { loadModel } from './model';

describe('items-platform model', () => {
  const model = loadModel();
  const byId = new Map(model.entities.map((e) => [e.id, e]));

  it('has all 22 entities', () => {
    expect(model.entities).toHaveLength(22);
    expect(byId.has('item_values')).toBe(true);
    expect(byId.has('option_transitions')).toBe(true);
    expect(byId.has('outbox')).toBe(true);
  });

  it('declares every column as explicitly nullable or not', () => {
    for (const entity of model.entities) {
      for (const column of entity.columns) {
        expect(typeof column.nullable, `${entity.id}.${column.name}`).toBe('boolean');
      }
    }
  });

  it('declares the three enums', () => {
    const names = model.enums.map((e) => e.name).sort();
    expect(names).toEqual(['field_type', 'status_kind', 'user_kind']);
    const fieldType = model.enums.find((e) => e.name === 'field_type')!;
    expect(fieldType.values).toEqual([
      'string', 'number', 'boolean', 'date', 'datetime', 'option', 'user', 'json',
    ]);
  });

  it('gives options a nullable kind column (the model amendment)', () => {
    const kind = byId.get('options')!.columns.find((c) => c.name === 'kind')!;
    expect(kind.type).toBe('status_kind');
    expect(kind.nullable).toBe(true);
  });

  it('carries the item_values integrity check', () => {
    const check = byId.get('item_values')!.constraints.find((c) => c.kind === 'check');
    expect(check).toBeDefined();
    expect(check!.expression).toMatch(/num_nonnulls/);
  });

  it('carries the item_values partial unique indexes', () => {
    const indexes = byId.get('item_values')!.indexes;
    const scalar = indexes.find((i) => i.name === 'iv_scalar')!;
    expect(scalar.unique).toBe(true);
    expect(scalar.where).toBe('option_id IS NULL AND value_user_id IS NULL');
  });

  it('carries the events stream-seq unique', () => {
    const unique = byId
      .get('events')!
      .constraints.find((c) => c.kind === 'unique' && c.name === 'events_stream_seq')!;
    expect(unique.columns).toEqual(['aggregate_type', 'aggregate_id', 'seq']);
  });

  it('carries composite primary keys on the join tables', () => {
    const pk = byId.get('item_type_fields')!.constraints.find((c) => c.kind === 'pk')!;
    expect(pk.columns).toEqual(['item_type_id', 'field_id']);
  });

  it('leaves no entity with an empty index list where the schema needs one', () => {
    expect(byId.get('items')!.indexes.length).toBeGreaterThan(0);
    expect(byId.get('events')!.indexes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @tickets/db test -- model.test.ts
```

Expected: FAIL — `Cannot find module './model'`.

- [ ] **Step 3: Write the loader**

Create `packages/db/src/schema/model.ts`:

```ts
// packages/db/src/schema/model.ts
// Reads apps/eer/models/items-platform.json — the schema SSOT. The conformance
// test (model-conformance.test.ts) diffs the drizzle schema against this.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type EerColumn = {
  name: string;
  type: string;
  nullable: boolean;
  default?: string | null;
  title?: string;
  description?: string;
};

export type EerConstraint =
  | { id: string; kind: 'pk'; name?: string | null; columns: string[] }
  | { id: string; kind: 'unique'; name?: string | null; columns: string[]; nullsNotDistinct?: boolean }
  | { id: string; kind: 'check'; name?: string | null; expression: string }
  | {
      id: string;
      kind: 'fk';
      name?: string | null;
      columns: string[];
      refTable: string;
      refColumns: string[];
    };

export type EerIndexColumn = { expression: string; isExpression?: boolean };
export type EerIndex = {
  id: string;
  name: string;
  columns: EerIndexColumn[];
  unique: boolean;
  method?: string | null;
  where?: string | null;
};

export type EerEntity = {
  id: string;
  label: string;
  group: string;
  columns: EerColumn[];
  constraints: EerConstraint[];
  indexes: EerIndex[];
};

export type EerEnum = { name: string; values: string[] };
export type EerGroup = { id: string; label: string; order: number; parent?: string };

export type EerModel = {
  entities: EerEntity[];
  groups: EerGroup[];
  enums: EerEnum[];
};

const MODEL_PATH = resolve(
  import.meta.dirname,
  '../../../../apps/eer/models/items-platform.json',
);

export function loadModel(): EerModel {
  const raw = JSON.parse(readFileSync(MODEL_PATH, 'utf8')) as {
    entities: EerEntity[];
    groups: EerGroup[];
    enums?: EerEnum[];
  };
  return {
    entities: raw.entities,
    groups: raw.groups,
    enums: raw.enums ?? [],
  };
}

// Resolves a model group id to its top-level zone (the model nests one level).
export function topLevelGroup(model: EerModel, groupId: string): string {
  const group = model.groups.find((g) => g.id === groupId);
  if (!group) throw new Error(`unknown group "${groupId}"`);
  return group.parent ?? group.id;
}
```

- [ ] **Step 4: Enrich the model file — enums**

In `apps/eer/models/items-platform.json`, add a top-level `"enums"` array (a sibling of `"entities"`):

```jsonc
"enums": [
  { "name": "user_kind",   "values": ["human", "agent"], "schema": null },
  { "name": "status_kind", "values": ["todo", "active", "blocked", "done", "dropped"], "schema": null },
  { "name": "field_type",  "values": ["string", "number", "boolean", "date", "datetime", "option", "user", "json"], "schema": null }
]
```

Then set the three enum-typed columns' `"type"` to the enum's **name** (they currently say `"enum"`): `users.kind` → `"user_kind"`, `fields.type` → `"field_type"`, and the new `options.kind` → `"status_kind"`.

- [ ] **Step 5: Enrich the model file — the `options.kind` amendment**

Add this column to the `options` entity, after `position`:

```jsonc
{
  "name": "kind",
  "type": "status_kind",
  "nullable": true,
  "title": "Kind",
  "description": "Lifecycle semantic for workflow options; null for non-workflow options. (todo | active | blocked | done | dropped)"
}
```

`color` and `icon` stay inside `config`. Rationale is in spec §4: `kind` is queried (16 files), `color`/`icon` are only rendered.

- [ ] **Step 6: Enrich the model file — nullability on every column**

Add `"nullable": true` to exactly these columns. **Every other column in every entity gets `"nullable": false`.**

| Entity | Nullable columns |
| --- | --- |
| `users` | `email`, `archived_at` |
| `views` | `archived_at` |
| `schemes` | `archived_at` |
| `item_types` | `archived_at` |
| `item_type_fields` | `config_override` |
| `fields` | `option_set_id`, `archived_at` |
| `options` | `kind`, `archived_at` |
| `option_transitions` | `from_option_id`, `item_type_id` |
| `link_types` | `archived_at` |
| `items` | `parent_id`, `archived_at` |
| `item_values` | `value_text`, `value_number`, `value_date`, `value_bool`, `value_json`, `option_id`, `value_user_id` |
| `comments` | `parent_id` |
| `events` | `caused_by`, `project_id` |
| `commands` | `result` |
| `outbox` | `picked_at`, `done_at` |

(`projects`, `item_type_child_types`, `option_sets`, `link_type_target_types`, `comment_reactions`, `item_links`, `item_activity` have no nullable columns.)

- [ ] **Step 7: Enrich the model file — constraints**

Add these to each entity's `constraints` array, alongside the `pk`/`fk` entries already there. `id` values must be unique within the entity; continue the existing `c1`, `c2`, … numbering.

```jsonc
// users
{ "id": "u1", "kind": "unique", "name": "users_name_unique", "columns": ["name"], "nullsNotDistinct": false }
// projects
{ "id": "u1", "kind": "unique", "name": "projects_key_unique", "columns": ["key"], "nullsNotDistinct": false }
// schemes
{ "id": "u1", "kind": "unique", "name": "schemes_key_unique", "columns": ["key"], "nullsNotDistinct": false }
// item_types
{ "id": "u1", "kind": "unique", "name": "item_types_scheme_key", "columns": ["scheme_id", "key"], "nullsNotDistinct": false }
// item_type_child_types  — composite PK (the model has none today)
{ "id": "p1", "kind": "pk", "name": null, "columns": ["parent_type_id", "child_type_id"] }
// item_type_fields — composite PK
{ "id": "p1", "kind": "pk", "name": null, "columns": ["item_type_id", "field_id"] }
// fields
{ "id": "u1", "kind": "unique", "name": "fields_scheme_key", "columns": ["scheme_id", "key"], "nullsNotDistinct": false },
{ "id": "k1", "kind": "check", "name": "fields_option_set_required",
  "expression": "type <> 'option' OR option_set_id IS NOT NULL" }
// option_sets
{ "id": "u1", "kind": "unique", "name": "option_sets_scheme_key", "columns": ["scheme_id", "key"], "nullsNotDistinct": false }
// options
{ "id": "u1", "kind": "unique", "name": "options_set_value", "columns": ["option_set_id", "value"], "nullsNotDistinct": false }
// option_transitions — NULLS NOT DISTINCT: null from_option_id (= start) and null item_type_id (= all types) must collide
{ "id": "u1", "kind": "unique", "name": "option_transitions_edge",
  "columns": ["field_id", "from_option_id", "to_option_id", "item_type_id"], "nullsNotDistinct": true }
// link_types
{ "id": "u1", "kind": "unique", "name": "link_types_type_key", "columns": ["item_type_id", "key"], "nullsNotDistinct": false }
// link_type_target_types — composite PK
{ "id": "p1", "kind": "pk", "name": null, "columns": ["link_type_id", "target_type_id"] }
// items
{ "id": "u1", "kind": "unique", "name": "items_project_number", "columns": ["project_id", "number"], "nullsNotDistinct": false }
// item_values
{ "id": "k1", "kind": "check", "name": "iv_one_value",
  "expression": "num_nonnulls(value_text, value_number, value_date, value_bool, value_json, option_id, value_user_id) = 1" }
// comment_reactions
{ "id": "u1", "kind": "unique", "name": "comment_reactions_unique", "columns": ["comment_id", "user_id", "emoji"], "nullsNotDistinct": false }
// item_links
{ "id": "u1", "kind": "unique", "name": "item_links_unique", "columns": ["link_type_id", "source_item_id", "target_item_id"], "nullsNotDistinct": false },
{ "id": "k1", "kind": "check", "name": "item_links_no_self", "expression": "source_item_id <> target_item_id" }
// events
{ "id": "u1", "kind": "unique", "name": "events_stream_seq", "columns": ["aggregate_type", "aggregate_id", "seq"], "nullsNotDistinct": false },
{ "id": "f9", "kind": "fk", "name": null, "columns": ["caused_by"], "refTable": "events", "refColumns": ["id"] }
// item_activity
{ "id": "u1", "kind": "unique", "name": "item_activity_event", "columns": ["event_id"], "nullsNotDistinct": false }
```

- [ ] **Step 8: Enrich the model file — indexes**

Replace each entity's `"indexes": []` with these. Entities not listed keep `[]`.

```jsonc
// items
[ { "id": "i1", "name": "items_project_type", "columns": [{"expression": "project_id"}, {"expression": "type_id"}], "unique": false, "method": "btree", "where": null },
  { "id": "i2", "name": "items_parent",       "columns": [{"expression": "parent_id"}],                            "unique": false, "method": "btree", "where": null } ]

// item_values — the three partial uniques are the NULL-distinct fix, plus board filter indexes
[ { "id": "i1", "name": "iv_scalar", "columns": [{"expression": "item_id"}, {"expression": "field_id"}],
    "unique": true,  "method": "btree", "where": "option_id IS NULL AND value_user_id IS NULL" },
  { "id": "i2", "name": "iv_option", "columns": [{"expression": "item_id"}, {"expression": "field_id"}, {"expression": "option_id"}],
    "unique": true,  "method": "btree", "where": "option_id IS NOT NULL" },
  { "id": "i3", "name": "iv_user",   "columns": [{"expression": "item_id"}, {"expression": "field_id"}, {"expression": "value_user_id"}],
    "unique": true,  "method": "btree", "where": "value_user_id IS NOT NULL" },
  { "id": "i4", "name": "iv_item",         "columns": [{"expression": "item_id"}],                                   "unique": false, "method": "btree", "where": null },
  { "id": "i5", "name": "iv_field_text",   "columns": [{"expression": "field_id"}, {"expression": "value_text"}],    "unique": false, "method": "btree", "where": null },
  { "id": "i6", "name": "iv_field_number", "columns": [{"expression": "field_id"}, {"expression": "value_number"}],  "unique": false, "method": "btree", "where": null },
  { "id": "i7", "name": "iv_field_date",   "columns": [{"expression": "field_id"}, {"expression": "value_date"}],    "unique": false, "method": "btree", "where": null },
  { "id": "i8", "name": "iv_field_option", "columns": [{"expression": "field_id"}, {"expression": "option_id"}],     "unique": false, "method": "btree", "where": null },
  { "id": "i9", "name": "iv_field_user",   "columns": [{"expression": "field_id"}, {"expression": "value_user_id"}], "unique": false, "method": "btree", "where": null } ]

// item_type_fields
[ { "id": "i1", "name": "itf_type_position", "columns": [{"expression": "item_type_id"}, {"expression": "position"}], "unique": false, "method": "btree", "where": null } ]

// item_links
[ { "id": "i1", "name": "item_links_source", "columns": [{"expression": "source_item_id"}], "unique": false, "method": "btree", "where": null },
  { "id": "i2", "name": "item_links_target", "columns": [{"expression": "target_item_id"}], "unique": false, "method": "btree", "where": null } ]

// events
[ { "id": "i1", "name": "events_correlation", "columns": [{"expression": "correlation_id"}], "unique": false, "method": "btree", "where": null },
  { "id": "i2", "name": "events_command",     "columns": [{"expression": "aggregate_type"}, {"expression": "aggregate_id"}, {"expression": "command_id"}], "unique": false, "method": "btree", "where": null },
  { "id": "i3", "name": "events_caused_by",   "columns": [{"expression": "caused_by"}],      "unique": false, "method": "btree", "where": null },
  { "id": "i4", "name": "events_project_at",  "columns": [{"expression": "project_id"}, {"expression": "at"}], "unique": false, "method": "btree", "where": null },
  { "id": "i5", "name": "events_stream_at",   "columns": [{"expression": "aggregate_type"}, {"expression": "aggregate_id"}, {"expression": "at"}], "unique": false, "method": "btree", "where": null } ]

// outbox — the worker scans undelivered rows only
[ { "id": "i1", "name": "outbox_pending", "columns": [{"expression": "event_id"}], "unique": false, "method": "btree", "where": "done_at IS NULL" } ]

// item_activity
[ { "id": "i1", "name": "item_activity_item_at",     "columns": [{"expression": "item_id"}, {"expression": "at"}], "unique": false, "method": "btree", "where": null },
  { "id": "i2", "name": "item_activity_correlation", "columns": [{"expression": "correlation_id"}],                "unique": false, "method": "btree", "where": null } ]

// comments
[ { "id": "i1", "name": "comments_item", "columns": [{"expression": "item_id"}], "unique": false, "method": "btree", "where": null } ]
```

- [ ] **Step 9: Run the tests**

```bash
pnpm --filter @tickets/db test -- model.test.ts
```

Expected: PASS, all 8 tests.

- [ ] **Step 10: Prove the eer app still loads the model**

The parallel workstream owns the editor; our enrichment must not break it.

```bash
pnpm --filter @tickets/eer test
```

Expected: PASS. If `load-model` rejects anything we added, the model format and this plan disagree — **stop and report**, do not "fix" it by weakening the model.

- [ ] **Step 11: Commit**

```bash
git add apps/eer/models/items-platform.json packages/db/src/schema/model.ts packages/db/src/schema/model.test.ts
git commit -m "feat(db): the eer model carries the whole DDL — nullability, constraints, indexes, enums

Adds options.kind as a nullable status_kind column (spec §4): kind is queried
by 16 files, color/icon are only rendered, so kind gets a column.

packages/db can now read the model; the conformance test lands next."
```

---

## Task 2: `describeSchema()` describes the whole schema

It already returns columns, PKs, uniques and FKs. It needs checks, indexes and enums before it can be diffed against the enriched model.

**Files:**
- Modify: `packages/db/src/schema/describe-schema.ts`
- Test: `packages/db/src/schema/describe-schema.test.ts:1-60` (extend)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `SchemaGraph` gains `enums: EnumMeta[]`, and `TableMeta` gains `checks: CheckMeta[]` and `indexes: IndexMeta[]`. Task 3 diffs these against the model.

- [ ] **Step 1: Write the failing test**

Append to `packages/db/src/schema/describe-schema.test.ts`:

```ts
describe('describeSchema — SQL truth', () => {
  const graph = describeSchema();
  const byName = new Map(graph.tables.map((t) => [t.name, t]));

  it('exposes indexes with their partial predicate', () => {
    const tv = byName.get('ticket_values')!;
    const single = tv.indexes.find((i) => i.name === 'ticket_values_single')!;
    expect(single.unique).toBe(true);
    expect(single.where).toMatch(/option_id IS NULL/i);
  });

  it('exposes check constraints', () => {
    // no checks in the current schema; the array must still exist
    expect(Array.isArray(byName.get('tickets')!.checks)).toBe(true);
  });

  it('exposes the declared enums', () => {
    const names = graph.enums.map((e) => e.name).sort();
    expect(names).toContain('field_type');
    expect(names).toContain('user_kind');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @tickets/db test -- describe-schema.test.ts
```

Expected: FAIL — `tv.indexes` is undefined.

- [ ] **Step 3: Extend `describe-schema.ts`**

Add the types and populate them from `getTableConfig`. Insert after the existing `UniqueMeta` type:

```ts
export type CheckMeta = { name: string; expression: string };
export type IndexMeta = {
  name: string;
  columns: string[];
  unique: boolean;
  method: string | null;
  where: string | null;
};
export type EnumMeta = { name: string; values: string[] };
```

Extend `TableMeta` with `checks: CheckMeta[]` and `indexes: IndexMeta[]`, and `SchemaGraph` with `enums: EnumMeta[]`.

Inside `describeSchema()`'s `allTables.map(...)`, after the `columns` block, add:

```ts
    const checks: CheckMeta[] = cfg.checks.map((c) => ({
      name: c.name,
      expression: renderSql(c.value),
    }));

    const indexes: IndexMeta[] = cfg.indexes.map((ix) => {
      const c = ix.config;
      return {
        name: c.name ?? '',
        columns: (c.columns ?? []).map((col) =>
          'name' in col ? (col as { name: string }).name : renderSql(col),
        ),
        unique: c.unique === true,
        method: c.method ?? null,
        where: c.where ? renderSql(c.where) : null,
      };
    });
```

Return them on the meta object, and add `enums` to the returned graph:

```ts
    return { name, group, columns, primaryKey: [...pkNames], uniques: /* … */, checks, indexes };
```

```ts
  const enums: EnumMeta[] = allEnums.map((e) => ({ name: e.enumName, values: [...e.enumValues] }));
  return { tables: metas, groups, enums };
```

Add the SQL renderer at the top of the file — drizzle stores `check.value` and `index.where` as `SQL` objects, and the dialect turns them back into text:

```ts
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const dialect = new PgDialect();
const renderSql = (sql: SQL | unknown): string =>
  dialect.sqlToQuery(sql as SQL).sql;
```

- [ ] **Step 4: Export the enums from the registry**

In `packages/db/src/schema/registry.ts`, add below `allTables`:

```ts
import { fieldTypeEnum, statusKindEnum, userKindEnum } from './enums';

// Every pgEnum in the schema. The conformance test checks these against the model.
export const allEnums = [userKindEnum, statusKindEnum, fieldTypeEnum];
```

- [ ] **Step 5: Run the tests**

```bash
pnpm --filter @tickets/db test
```

Expected: PASS — the new SQL-truth tests plus all pre-existing `describe-schema` tests.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/describe-schema.ts packages/db/src/schema/describe-schema.test.ts packages/db/src/schema/registry.ts
git commit -m "feat(db): describeSchema reports checks, indexes and enums

Everything needed to diff drizzle against the eer model. Still describing the
old schema — the rebuild lands next."
```

---

## Task 3: The conformance test (RED)

Write the test that pins drizzle to the model. It will fail — the schema is still `ticket*`. Task 4 makes it pass. This is the TDD gate for the entire rebuild.

**Files:**
- Create: `packages/db/src/schema/model-conformance.test.ts`

**Interfaces:**
- Consumes: `loadModel()`, `topLevelGroup()` (Task 1); `describeSchema()` with `checks`/`indexes`/`enums` (Task 2).
- Produces: nothing — this is a gate.

- [ ] **Step 1: Write the test**

Create `packages/db/src/schema/model-conformance.test.ts`:

```ts
// packages/db/src/schema/model-conformance.test.ts
// The drizzle schema and apps/eer/models/items-platform.json must agree, in BOTH
// directions. A stray table in drizzle fails as loudly as a missing one.
import { describe, expect, it } from 'vitest';
import { describeSchema } from './describe-schema';
import { loadModel, topLevelGroup } from './model';

// model type name -> the type string drizzle's getSQLType() produces
const TYPE_MAP: Record<string, string> = {
  serial: 'serial',
  bigserial: 'bigserial',
  int: 'integer',
  bigint: 'bigint',
  text: 'text',
  numeric: 'numeric',
  boolean: 'boolean',
  jsonb: 'jsonb',
  uuid: 'uuid',
  timestamptz: 'timestamptz',
  user_kind: 'user_kind',
  status_kind: 'status_kind',
  field_type: 'field_type',
};

const normalizeExpression = (s: string): string =>
  s.replace(/"/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

describe('drizzle ⇔ items-platform.json', () => {
  const model = loadModel();
  const graph = describeSchema();
  const modelById = new Map(model.entities.map((e) => [e.id, e]));
  const tableByName = new Map(graph.tables.map((t) => [t.name, t]));

  it('has exactly the model\'s tables — no more, no less', () => {
    expect([...tableByName.keys()].sort()).toEqual([...modelById.keys()].sort());
  });

  it.each([...modelById.keys()])('%s: columns match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    expect(table.columns.map((c) => c.name)).toEqual(entity.columns.map((c) => c.name));
  });

  it.each([...modelById.keys()])('%s: types and nullability match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    for (const column of entity.columns) {
      const actual = table.columns.find((c) => c.name === column.name)!;
      const expectedType = TYPE_MAP[column.type];
      expect(expectedType, `unmapped model type "${column.type}"`).toBeDefined();
      expect(actual.type, `${id}.${column.name} type`).toBe(expectedType);
      expect(actual.notNull, `${id}.${column.name} nullability`).toBe(!column.nullable);
    }
  });

  it.each([...modelById.keys()])('%s: primary key matches', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    const pk = entity.constraints.find((c) => c.kind === 'pk');
    expect([...table.primaryKey].sort()).toEqual([...(pk?.columns ?? [])].sort());
  });

  it.each([...modelById.keys()])('%s: foreign keys match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    const modelFks = entity.constraints
      .filter((c) => c.kind === 'fk')
      .map((c) => `${c.columns[0]} -> ${c.refTable}.${c.refColumns[0]}`)
      .sort();
    const drizzleFks = table.columns
      .filter((c) => c.fk)
      .map((c) => `${c.name} -> ${c.fk!.table}.${c.fk!.column}`)
      .sort();
    expect(drizzleFks).toEqual(modelFks);
  });

  it.each([...modelById.keys()])('%s: uniques match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    const expected = entity.constraints
      .filter((c) => c.kind === 'unique')
      .map((c) => `${c.name}(${c.columns.join(',')})`)
      .sort();
    const actual = table.uniques.map((u) => `${u.name}(${u.columns.join(',')})`).sort();
    expect(actual).toEqual(expected);
  });

  it.each([...modelById.keys()])('%s: checks match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    const expected = entity.constraints
      .filter((c) => c.kind === 'check')
      .map((c) => `${c.name}:${normalizeExpression(c.expression)}`)
      .sort();
    const actual = table.checks
      .map((c) => `${c.name}:${normalizeExpression(c.expression)}`)
      .sort();
    expect(actual).toEqual(expected);
  });

  it.each([...modelById.keys()])('%s: indexes match', (id) => {
    const entity = modelById.get(id)!;
    const table = tableByName.get(id)!;
    const expected = entity.indexes
      .map((i) =>
        [
          i.name,
          i.columns.map((c) => c.expression).join(','),
          i.unique ? 'unique' : 'plain',
          i.where ? normalizeExpression(i.where) : '-',
        ].join('|'),
      )
      .sort();
    const actual = table.indexes
      .map((i) =>
        [
          i.name,
          i.columns.join(','),
          i.unique ? 'unique' : 'plain',
          i.where ? normalizeExpression(i.where) : '-',
        ].join('|'),
      )
      .sort();
    expect(actual).toEqual(expected);
  });

  it('enums match', () => {
    const expected = model.enums
      .map((e) => `${e.name}(${e.values.join(',')})`)
      .sort();
    const actual = graph.enums.map((e) => `${e.name}(${e.values.join(',')})`).sort();
    expect(actual).toEqual(expected);
  });

  it('every table sits in the group the model puts it in', () => {
    for (const entity of model.entities) {
      const table = tableByName.get(entity.id)!;
      expect(table.group, entity.id).toBe(topLevelGroup(model, entity.group));
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @tickets/db test -- model-conformance.test.ts
```

Expected: FAIL on the very first test — drizzle has `tickets`, `statuses`, `ticket_values`…; the model has `items`, `options`, `item_values`…. **This red bar is the definition of done for Task 4.**

- [ ] **Step 3: Commit the failing test**

```bash
git add packages/db/src/schema/model-conformance.test.ts
git commit -m "test(db): pin drizzle to the eer model (RED)

Fails against the ticket* schema by design. Task 4 makes it green."
```

---

## Task 4: The 22-table schema (GREEN)

Rewrite the schema to the model. The conformance test from Task 3 is the gate.

**Files:**
- Rewrite: `packages/db/src/schema/enums.ts`
- Create: 22 table files (see [File Structure](#file-structure))
- Delete: `tickets.ts`, `ticket-values.ts`, `ticket-events.ts`, `ticket-types.ts`, `ticket-type-child-types.ts`, `ticket-links.ts`, `statuses.ts`, `status-transitions.ts`, `field-options.ts`
- Rewrite: `registry.ts`, `schema-groups.ts`, `index.ts`

**Interfaces:**
- Consumes: the conformance test (Task 3).
- Produces: every table export used by Tasks 6–12 — `users`, `projects`, `views`, `schemes`, `itemTypes`, `itemTypeChildTypes`, `itemTypeFields`, `fields`, `optionSets`, `options`, `optionTransitions`, `linkTypes`, `linkTypeTargetTypes`, `items`, `itemValues`, `comments`, `commentReactions`, `itemLinks`, `events`, `commands`, `outbox`, `itemActivity`.

- [ ] **Step 1: Rewrite the enums**

`packages/db/src/schema/enums.ts`:

```ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const userKindEnum = pgEnum('user_kind', ['human', 'agent']);

// The one workflow semantic code knows: what counts as done/active for tiles,
// progress rollups and filter buckets. Lives on options.kind (nullable — only
// workflow options carry it).
export const statusKindEnum = pgEnum('status_kind', [
  'todo',
  'active',
  'blocked',
  'done',
  'dropped',
]);

// Format (url/email/markdown) and cardinality (multiple) ride in fields.config,
// not in the type. There is no 'status' type — a workflow status is an option
// field whose option set carries kinds and whose graph is option_transitions.
export const fieldTypeEnum = pgEnum('field_type', [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'option',
  'user',
  'json',
]);
```

- [ ] **Step 2: Write the WORKSPACE tables**

`users.ts`:

```ts
import { integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { userKindEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email'),
    kind: userKindEnum('kind').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [unique('users_name_unique').on(t.name)],
);
```

`projects.ts`:

```ts
import { integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';

export const projects = pgTable(
  'projects',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    itemPrefix: text('item_prefix').notNull(),
    schemeId: integer('scheme_id')
      .notNull()
      .references(() => schemes.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique('projects_key_unique').on(t.key)],
);
```

`views.ts`:

```ts
import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const views = pgTable('views', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name').notNull(),
  position: integer('position').notNull(),
  config: jsonb('config')
    .notNull()
    .default(sql`'{}'::jsonb`),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
});
```

- [ ] **Step 3: Write the STRUCTURE tables**

`schemes.ts`:

```ts
import { sql } from 'drizzle-orm';
import { jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const schemes = pgTable(
  'schemes',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [unique('schemes_key_unique').on(t.key)],
);
```

`item-types.ts`:

```ts
import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';

export const itemTypes = pgTable(
  'item_types',
  {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id')
      .notNull()
      .references(() => schemes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    position: integer('position').notNull(),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [unique('item_types_scheme_key').on(t.schemeId, t.key)],
);
```

`item-type-child-types.ts`:

```ts
import { integer, pgTable, primaryKey, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { itemTypes } from './item-types';

export const itemTypeChildTypes = pgTable(
  'item_type_child_types',
  {
    parentTypeId: integer('parent_type_id')
      .notNull()
      .references((): AnyPgColumn => itemTypes.id),
    childTypeId: integer('child_type_id')
      .notNull()
      .references((): AnyPgColumn => itemTypes.id),
  },
  (t) => [primaryKey({ columns: [t.parentTypeId, t.childTypeId] })],
);
```

`option-sets.ts`:

```ts
import { integer, pgTable, serial, text, unique } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';

export const optionSets = pgTable(
  'option_sets',
  {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id')
      .notNull()
      .references(() => schemes.id),
    key: text('key').notNull(),
    name: text('name').notNull(),
  },
  (t) => [unique('option_sets_scheme_key').on(t.schemeId, t.key)],
);
```

`options.ts`:

```ts
import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { statusKindEnum } from './enums';
import { optionSets } from './option-sets';

export const options = pgTable(
  'options',
  {
    id: serial('id').primaryKey(),
    optionSetId: integer('option_set_id')
      .notNull()
      .references(() => optionSets.id),
    value: text('value').notNull(),
    label: text('label').notNull(),
    position: integer('position').notNull(),
    // null on non-workflow options (priority, labels, component, …)
    kind: statusKindEnum('kind'),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [unique('options_set_value').on(t.optionSetId, t.value)],
);
```

`fields.ts`:

```ts
import { sql } from 'drizzle-orm';
import {
  boolean, check, integer, jsonb, pgTable, serial, text, timestamp, unique,
} from 'drizzle-orm/pg-core';
import { fieldTypeEnum } from './enums';
import { optionSets } from './option-sets';
import { schemes } from './schemes';

// A scheme-scoped shared definition. Placement (position/required/overrides)
// lives on item_type_fields — definition vs placement.
export const fields = pgTable(
  'fields',
  {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id')
      .notNull()
      .references(() => schemes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    type: fieldTypeEnum('type').notNull(),
    system: boolean('system').notNull().default(false),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    optionSetId: integer('option_set_id').references(() => optionSets.id),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [
    unique('fields_scheme_key').on(t.schemeId, t.key),
    check('fields_option_set_required', sql`type <> 'option' OR option_set_id IS NOT NULL`),
  ],
);
```

`item-type-fields.ts`:

```ts
import { boolean, index, integer, jsonb, pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { fields } from './fields';
import { itemTypes } from './item-types';

// Placement: which fields a type shows, in what order, required or not.
// config_override carries per-type tweaks — e.g. allowedOptionIds, the status
// subset for this type.
export const itemTypeFields = pgTable(
  'item_type_fields',
  {
    itemTypeId: integer('item_type_id')
      .notNull()
      .references(() => itemTypes.id),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    position: integer('position').notNull(),
    required: boolean('required').notNull().default(false),
    configOverride: jsonb('config_override'),
  },
  (t) => [
    primaryKey({ columns: [t.itemTypeId, t.fieldId] }),
    index('itf_type_position').on(t.itemTypeId, t.position),
  ],
);
```

`option-transitions.ts`:

```ts
import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, unique } from 'drizzle-orm/pg-core';
import { fields } from './fields';
import { itemTypes } from './item-types';
import { options } from './options';

// The workflow graph. from_option_id NULL = a valid starting option;
// item_type_id NULL = applies to every type using the field.
export const optionTransitions = pgTable(
  'option_transitions',
  {
    id: serial('id').primaryKey(),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    fromOptionId: integer('from_option_id').references(() => options.id),
    toOptionId: integer('to_option_id')
      .notNull()
      .references(() => options.id),
    itemTypeId: integer('item_type_id').references(() => itemTypes.id),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    unique('option_transitions_edge')
      .on(t.fieldId, t.fromOptionId, t.toOptionId, t.itemTypeId)
      .nullsNotDistinct(),
  ],
);
```

`link-types.ts`:

```ts
import { boolean, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { itemTypes } from './item-types';

export const linkTypes = pgTable(
  'link_types',
  {
    id: serial('id').primaryKey(),
    itemTypeId: integer('item_type_id')
      .notNull()
      .references(() => itemTypes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    inverseLabel: text('inverse_label').notNull(),
    directional: boolean('directional').notNull(),
    position: integer('position').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [unique('link_types_type_key').on(t.itemTypeId, t.key)],
);
```

`link-type-target-types.ts`:

```ts
import { integer, pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { itemTypes } from './item-types';
import { linkTypes } from './link-types';

export const linkTypeTargetTypes = pgTable(
  'link_type_target_types',
  {
    linkTypeId: integer('link_type_id')
      .notNull()
      .references(() => linkTypes.id),
    targetTypeId: integer('target_type_id')
      .notNull()
      .references(() => itemTypes.id),
  },
  (t) => [primaryKey({ columns: [t.linkTypeId, t.targetTypeId] })],
);
```

- [ ] **Step 4: Write the RECORDS tables**

`items.ts`:

```ts
import {
  index, integer, pgTable, serial, timestamp, unique, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { itemTypes } from './item-types';
import { projects } from './projects';
import { users } from './users';

// Pure skeleton — everything user-visible lives in item_values.
export const items = pgTable(
  'items',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    typeId: integer('type_id')
      .notNull()
      .references(() => itemTypes.id),
    parentId: integer('parent_id').references((): AnyPgColumn => items.id),
    number: integer('number').notNull(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    // doubles as the optimistic-lock token — always compare as text
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('items_project_number').on(t.projectId, t.number),
    index('items_project_type').on(t.projectId, t.typeId),
    index('items_parent').on(t.parentId),
  ],
);
```

`item-values.ts` — the hardened EAV table (spec §3.1):

```ts
import { sql } from 'drizzle-orm';
import {
  boolean, check, index, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { fields } from './fields';
import { items } from './items';
import { options } from './options';
import { users } from './users';

// Exactly one value column is populated per row — enforced by the DB, not the
// app. Multi-value (option/user) = N rows. No status_id: a workflow status is
// an option value like any other.
export const itemValues = pgTable(
  'item_values',
  {
    id: serial('id').primaryKey(),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    valueText: text('value_text'),
    valueNumber: numeric('value_number'),
    valueDate: timestamp('value_date', { withTimezone: true, mode: 'string' }),
    valueBool: boolean('value_bool'),
    valueJson: jsonb('value_json'),
    optionId: integer('option_id').references(() => options.id),
    valueUserId: integer('value_user_id').references(() => users.id),
  },
  (t) => [
    check(
      'iv_one_value',
      sql`num_nonnulls(value_text, value_number, value_date, value_bool, value_json, option_id, value_user_id) = 1`,
    ),
    uniqueIndex('iv_scalar')
      .on(t.itemId, t.fieldId)
      .where(sql`option_id IS NULL AND value_user_id IS NULL`),
    uniqueIndex('iv_option')
      .on(t.itemId, t.fieldId, t.optionId)
      .where(sql`option_id IS NOT NULL`),
    uniqueIndex('iv_user')
      .on(t.itemId, t.fieldId, t.valueUserId)
      .where(sql`value_user_id IS NOT NULL`),
    index('iv_item').on(t.itemId),
    index('iv_field_text').on(t.fieldId, t.valueText),
    index('iv_field_number').on(t.fieldId, t.valueNumber),
    index('iv_field_date').on(t.fieldId, t.valueDate),
    index('iv_field_option').on(t.fieldId, t.optionId),
    index('iv_field_user').on(t.fieldId, t.valueUserId),
  ],
);
```

`comments.ts`:

```ts
import {
  index, integer, pgTable, serial, text, timestamp, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { items } from './items';
import { users } from './users';

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    parentId: integer('parent_id').references((): AnyPgColumn => comments.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('comments_item').on(t.itemId)],
);
```

`comment-reactions.ts`:

```ts
import { integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { comments } from './comments';
import { users } from './users';

export const commentReactions = pgTable(
  'comment_reactions',
  {
    id: serial('id').primaryKey(),
    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique('comment_reactions_unique').on(t.commentId, t.userId, t.emoji)],
);
```

`item-links.ts`:

```ts
import { sql } from 'drizzle-orm';
import {
  check, index, integer, pgTable, serial, timestamp, unique,
} from 'drizzle-orm/pg-core';
import { items } from './items';
import { linkTypes } from './link-types';

// Parent/child is NOT a link — that is items.parent_id.
export const itemLinks = pgTable(
  'item_links',
  {
    id: serial('id').primaryKey(),
    linkTypeId: integer('link_type_id')
      .notNull()
      .references(() => linkTypes.id),
    sourceItemId: integer('source_item_id')
      .notNull()
      .references(() => items.id),
    targetItemId: integer('target_item_id')
      .notNull()
      .references(() => items.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('item_links_unique').on(t.linkTypeId, t.sourceItemId, t.targetItemId),
    check('item_links_no_self', sql`source_item_id <> target_item_id`),
    index('item_links_source').on(t.sourceItemId),
    index('item_links_target').on(t.targetItemId),
  ],
);
```

- [ ] **Step 5: Write the HISTORY tables**

`events.ts` (spec §3.2):

```ts
import { sql } from 'drizzle-orm';
import {
  bigint, bigserial, index, integer, jsonb, pgTable, text, timestamp, unique, uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// Global append-only log, one stream per (aggregate_type, aggregate_id).
// version 0 = imported legacy row: lossy, display-only, never folded.
export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: integer('aggregate_id').notNull(),
    seq: integer('seq').notNull(),
    kind: text('kind').notNull(),
    version: integer('version').notNull().default(1),
    payload: jsonb('payload')
      .notNull()
      .default(sql`'{}'::jsonb`),
    actorId: integer('actor_id')
      .notNull()
      .references(() => users.id),
    at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    commandId: uuid('command_id').notNull(),
    correlationId: uuid('correlation_id').notNull(),
    causedBy: bigint('caused_by', { mode: 'number' }).references((): AnyPgColumn => events.id),
    depth: integer('depth').notNull().default(0),
    projectId: integer('project_id'),
  },
  (t) => [
    // stream order AND the optimistic-concurrency backstop
    unique('events_stream_seq').on(t.aggregateType, t.aggregateId, t.seq),
    index('events_correlation').on(t.correlationId),
    // trace only — one command emits many events, so NOT unique
    index('events_command').on(t.aggregateType, t.aggregateId, t.commandId),
    index('events_caused_by').on(t.causedBy),
    index('events_project_at').on(t.projectId, t.at),
    index('events_stream_at').on(t.aggregateType, t.aggregateId, t.at),
  ],
);
```

`commands.ts`:

```ts
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

// Idempotency ledger: a retried commandId collides here and the command is a no-op.
export const commands = pgTable('commands', {
  id: uuid('id').primaryKey(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: integer('aggregate_id').notNull(),
  actorId: integer('actor_id')
    .notNull()
    .references(() => users.id),
  at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  result: jsonb('result'),
});
```

`outbox.ts`:

```ts
import { sql } from 'drizzle-orm';
import { bigint, index, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { events } from './events';

// One row per event, written in the same transaction. A single worker drains it
// in id order (sub-project 3).
export const outbox = pgTable(
  'outbox',
  {
    eventId: bigint('event_id', { mode: 'number' })
      .primaryKey()
      .references(() => events.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    pickedAt: timestamp('picked_at', { withTimezone: true, mode: 'string' }),
    doneAt: timestamp('done_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [index('outbox_pending').on(t.eventId).where(sql`done_at IS NULL`)],
);
```

`item-activity.ts`:

```ts
import { bigint, bigserial, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { events } from './events';
import { items } from './items';
import { users } from './users';

// Feed projection — source events are value-only, so the diff is computed on
// fold and denormalised here. Built in sub-project 3; empty until then.
export const itemActivity = pgTable(
  'item_activity',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    eventId: bigint('event_id', { mode: 'number' })
      .notNull()
      .references(() => events.id),
    projectId: integer('project_id').notNull(),
    kind: text('kind').notNull(),
    actorId: integer('actor_id')
      .notNull()
      .references(() => users.id),
    at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
    summary: jsonb('summary').notNull(),
  },
  (t) => [
    unique('item_activity_event').on(t.eventId),
    index('item_activity_item_at').on(t.itemId, t.at),
    index('item_activity_correlation').on(t.correlationId),
  ],
);
```

- [ ] **Step 6: Delete the old tables and rewrite the registry, groups and barrel**

```bash
cd packages/db/src/schema
rm tickets.ts ticket-values.ts ticket-events.ts ticket-types.ts \
   ticket-type-child-types.ts ticket-links.ts statuses.ts status-transitions.ts field-options.ts
cd ../../../..
rm -rf packages/db/src/migrate-fields-links
```

`registry.ts`:

```ts
// packages/db/src/schema/registry.ts
import { commands } from './commands';
import { commentReactions } from './comment-reactions';
import { comments } from './comments';
import { fieldTypeEnum, statusKindEnum, userKindEnum } from './enums';
import { events } from './events';
import { fields } from './fields';
import { itemActivity } from './item-activity';
import { itemLinks } from './item-links';
import { itemTypeChildTypes } from './item-type-child-types';
import { itemTypeFields } from './item-type-fields';
import { itemTypes } from './item-types';
import { itemValues } from './item-values';
import { items } from './items';
import { linkTypeTargetTypes } from './link-type-target-types';
import { linkTypes } from './link-types';
import { optionSets } from './option-sets';
import { optionTransitions } from './option-transitions';
import { options } from './options';
import { outbox } from './outbox';
import { projects } from './projects';
import { schemes } from './schemes';
import { users } from './users';
import { views } from './views';

// Every pgTable in the schema. The conformance test forces this to equal the
// entity set in apps/eer/models/items-platform.json.
export const allTables = [
  users, projects, views,
  schemes, itemTypes, itemTypeChildTypes, itemTypeFields, fields,
  optionSets, options, optionTransitions, linkTypes, linkTypeTargetTypes,
  items, itemValues, comments, commentReactions, itemLinks,
  events, commands, outbox, itemActivity,
];

export const allEnums = [userKindEnum, statusKindEnum, fieldTypeEnum];
```

`schema-groups.ts` — replace `SCHEMA_GROUPS` with the model's four zones (keys must equal the model's top-level group ids):

```ts
export const SCHEMA_GROUPS: SchemaGroup[] = [
  {
    key: 'ws',
    label: 'Workspace',
    color: 'blue',
    tables: ['users', 'projects', 'views'],
  },
  {
    key: 'st',
    label: 'Structure',
    color: 'indigo',
    tables: [
      'schemes',
      'item_types',
      'item_type_child_types',
      'item_type_fields',
      'fields',
      'option_sets',
      'options',
      'option_transitions',
      'link_types',
      'link_type_target_types',
    ],
  },
  {
    key: 'rc',
    label: 'Records',
    color: 'orange',
    tables: ['items', 'item_values', 'comments', 'comment_reactions', 'item_links'],
  },
  {
    key: 'hi',
    label: 'History',
    color: 'teal',
    tables: ['events', 'commands', 'outbox', 'item_activity'],
  },
];
```

`index.ts` — re-export every new table file, dropping the deleted ones. Keep the non-schema exports (`createDbClient`, `environment`, the seed helpers) as they are.

- [ ] **Step 7: Run the conformance test — it must go GREEN**

```bash
pnpm --filter @tickets/db test -- model-conformance.test.ts
```

Expected: PASS, every assertion. If a type mismatch appears, fix **drizzle**, not the model — unless the model is genuinely wrong, in which case amend the model and say so in the commit (spec, locked decision 3).

- [ ] **Step 8: Typecheck the package**

```bash
pnpm --filter @tickets/db typecheck
```

Expected: PASS. (`apps/*` will not typecheck — see Global Constraints. That is correct.)

- [ ] **Step 9: Commit**

```bash
git add -A packages/db/src/schema packages/db/src/migrate-fields-links
git commit -m "feat(db)!: the items-platform schema — 22 tables, conformance-tested

Drops tickets/ticket_values/ticket_events/ticket_types/ticket_links/statuses/
status_transitions/field_options. Adds items + scheme-scoped reusable fields
(item_type_fields) + the three-table workflow vocabulary (option_sets/options/
option_transitions) + the event log (events/commands/outbox/item_activity).

item_values now enforces exactly-one-value in the DB (num_nonnulls check +
partial uniques), closing the NULL-distinct duplicate-row hole.

BREAKING: apps/api, apps/web and apps/mcp do not compile until sub-projects 2-4."
```

---

## Task 5: One migration

**Files:**
- Delete: `packages/db/drizzle/0000_*.sql` … `0007_*.sql`, `packages/db/drizzle/meta/`
- Create: `packages/db/drizzle/0000_<generated>.sql` + `meta/`

**Interfaces:**
- Consumes: the schema (Task 4).
- Produces: a `tickets_dev` database holding the new schema, for Tasks 6–12.

- [ ] **Step 1: Delete the migration history**

```bash
rm -rf packages/db/drizzle
```

- [ ] **Step 2: Generate exactly one migration**

```bash
pnpm --filter @tickets/db db:generate
ls packages/db/drizzle/*.sql
```

Expected: exactly one file, `0000_*.sql`. If drizzle-kit prompts about renames, answer **create** for everything — there is no old schema to rename from.

- [ ] **Step 3: Read the generated SQL and check the four things the model is easy to get wrong**

```bash
grep -nE "num_nonnulls|nulls not distinct|where|CREATE TYPE" packages/db/drizzle/0000_*.sql
```

Expected to find: the `iv_one_value` CHECK; `NULLS NOT DISTINCT` on `option_transitions_edge`; `WHERE` clauses on `iv_scalar` / `iv_option` / `iv_user` / `outbox_pending`; and `CREATE TYPE` for all three enums.

- [ ] **Step 4: Reset `tickets_dev` and apply**

```bash
docker exec tickets-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS tickets_dev;"
docker exec tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_dev;"
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db db:migrate
```

Expected: `migrations applied`.

- [ ] **Step 5: Verify the schema landed and that drizzle sees no drift**

```bash
docker exec tickets-postgres-1 psql -U postgres -d tickets_dev -c "\dt" | wc -l
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db db:generate
```

Expected: 22 tables listed; and `db:generate` reports **No schema changes, nothing to migrate** — if it emits a second migration file, the drizzle schema and the applied SQL disagree. Delete the stray file and fix the cause.

- [ ] **Step 6: Commit**

```bash
git add -A packages/db/drizzle
git commit -m "feat(db)!: collapse migration history to a single migration

Eight migrations of ticket* history deleted; one migration creates the items
platform. Applied to tickets_dev; the live app still runs on tickets."
```

---

## Task 6: The database rejects bad values

The `num_nonnulls` check and the partial uniques are the whole point of the EAV rebuild. Prove postgres enforces them — a drizzle-level test would only prove drizzle compiles.

**Files:**
- Create: `packages/db/src/schema/item-values-integrity.test.ts`

**Interfaces:**
- Consumes: `itemValues`, `items`, `fields`, `options`, `users` (Task 4); a migrated `tickets_dev` (Task 5).

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/item-values-integrity.test.ts`:

```ts
// packages/db/src/schema/item-values-integrity.test.ts
// These constraints must be enforced by POSTGRES, not by the app. Each case
// asserts the database itself rejects the write.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDbClient, type Db } from '../client';
import { fields } from './fields';
import { itemTypes } from './item-types';
import { items } from './items';
import { itemValues } from './item-values';
import { optionSets } from './option-sets';
import { options } from './options';
import { projects } from './projects';
import { schemes } from './schemes';
import { users } from './users';

describe('item_values integrity (requires POSTGRES_DATABASE=tickets_dev)', () => {
  let db: Db;
  let sql: ReturnType<typeof createDbClient>['sql'];
  let itemId = 0;
  let textFieldId = 0;
  let optionFieldId = 0;
  let optionA = 0;
  let optionB = 0;
  let userId = 0;

  beforeAll(async () => {
    ({ db, sql } = createDbClient({ max: 1 }));

    const [user] = await db.insert(users).values({ name: 'iv-test', kind: 'agent' }).returning();
    userId = user!.id;
    const [scheme] = await db.insert(schemes).values({ key: 'iv-test', name: 'iv' }).returning();
    const [type] = await db
      .insert(itemTypes)
      .values({ schemeId: scheme!.id, key: 'task', label: 'Task', position: 0 })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ key: 'IVT', name: 'iv', itemPrefix: 'IVT', schemeId: scheme!.id })
      .returning();
    const [set] = await db
      .insert(optionSets)
      .values({ schemeId: scheme!.id, key: 'prio', name: 'Priority' })
      .returning();
    const inserted = await db
      .insert(options)
      .values([
        { optionSetId: set!.id, value: 'high', label: 'High', position: 0 },
        { optionSetId: set!.id, value: 'low', label: 'Low', position: 1 },
      ])
      .returning();
    optionA = inserted[0]!.id;
    optionB = inserted[1]!.id;

    const [textField] = await db
      .insert(fields)
      .values({ schemeId: scheme!.id, key: 'title', label: 'Title', type: 'string' })
      .returning();
    textFieldId = textField!.id;
    const [optionField] = await db
      .insert(fields)
      .values({
        schemeId: scheme!.id, key: 'priority', label: 'Priority',
        type: 'option', optionSetId: set!.id,
      })
      .returning();
    optionFieldId = optionField!.id;

    const [item] = await db
      .insert(items)
      .values({ projectId: project!.id, typeId: type!.id, number: 1, createdBy: userId })
      .returning();
    itemId = item!.id;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('rejects a row with NO value column populated', async () => {
    await expect(
      db.insert(itemValues).values({ itemId, fieldId: textFieldId }),
    ).rejects.toThrow(/iv_one_value/);
  });

  it('rejects a row with TWO value columns populated', async () => {
    await expect(
      db.insert(itemValues).values({ itemId, fieldId: textFieldId, valueText: 'x', valueBool: true }),
    ).rejects.toThrow(/iv_one_value/);
  });

  it('rejects a duplicate scalar value for one (item, field)', async () => {
    await db.insert(itemValues).values({ itemId, fieldId: textFieldId, valueText: 'first' });
    await expect(
      db.insert(itemValues).values({ itemId, fieldId: textFieldId, valueText: 'second' }),
    ).rejects.toThrow(/iv_scalar/);
  });

  it('rejects the same option twice on one (item, field)', async () => {
    await db.insert(itemValues).values({ itemId, fieldId: optionFieldId, optionId: optionA });
    await expect(
      db.insert(itemValues).values({ itemId, fieldId: optionFieldId, optionId: optionA }),
    ).rejects.toThrow(/iv_option/);
  });

  it('ALLOWS two different options on one (item, field) — multi-select', async () => {
    await expect(
      db.insert(itemValues).values({ itemId, fieldId: optionFieldId, optionId: optionB }),
    ).resolves.toBeDefined();
  });

  it('rejects an option field with no option set', async () => {
    const [scheme] = await db.insert(schemes).values({ key: 'iv-test-2', name: 'iv2' }).returning();
    await expect(
      db.insert(fields).values({ schemeId: scheme!.id, key: 'bad', label: 'Bad', type: 'option' }),
    ).rejects.toThrow(/fields_option_set_required/);
  });
});
```

- [ ] **Step 2: Run it**

```bash
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db test -- item-values-integrity.test.ts
```

Expected: PASS, all 6. Every rejection message must name the constraint — that proves postgres refused the write, not drizzle.

If any *rejects* case resolves instead, the constraint did not land in the migration. Go back to Task 5 Step 3.

- [ ] **Step 3: Reset the database**

The test wrote scratch rows. Wipe them so Task 12's import starts clean:

```bash
docker exec tickets-postgres-1 psql -U postgres -c "DROP DATABASE tickets_dev;"
docker exec tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_dev;"
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db db:migrate
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/item-values-integrity.test.ts
git commit -m "test(db): postgres rejects malformed item_values rows

Zero or two value columns, duplicate scalars, duplicate options, and option
fields with no option set are all refused by the database itself."
```

---

## Task 7: The seed builds the new vocabulary

**Files:**
- Rewrite: `packages/db/src/seed/scheme-types.ts`, `software-scheme.ts`, `seed-scheme.ts`, `ensure-software-scheme.ts`, `seed-project.ts`, `verify-scheme.ts`, `build-transitions.ts`
- Test: `packages/db/src/seed/seed-scheme.test.ts`, `build-transitions.test.ts` (rewrite)

**Interfaces:**
- Consumes: the schema (Task 4).
- Produces: `seedScheme(db, def): Promise<SeededScheme>` where `SeededScheme = { schemeId: number; typeIdByKey: Map<string, number>; fieldIdByKey: Map<string, number>; optionIdByKey: Map<string, number> }` — the optionIdByKey key is `` `${optionSetKey}:${optionValue}` ``. Task 9 relies on the same declarative `SchemeDef` shape.

- [ ] **Step 1: Rewrite the declarative types**

`packages/db/src/seed/scheme-types.ts` — the shape now mirrors the new schema. **The status subsets that used to live per-type now live on the placement.**

```ts
export type StatusKind = 'todo' | 'active' | 'blocked' | 'done' | 'dropped';

export type OptionDef = {
  value: string;
  label: string;
  kind?: StatusKind;          // workflow options only
  config?: Record<string, unknown>; // color, icon
};

export type OptionSetDef = {
  key: string;
  name: string;
  options: OptionDef[];
};

export type FieldDef = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'option' | 'user' | 'json';
  system?: boolean;
  config?: Record<string, unknown>; // { multiple, format, workflow }
  optionSetKey?: string;            // required when type === 'option'
};

// Placement of a field on a type.
export type PlacementDef = {
  fieldKey: string;
  required?: boolean;
  // For the workflow field: the subset of the shared status set this type uses.
  allowedOptionValues?: string[];
};

export type TransitionDef = {
  fieldKey: string;
  fromValue: string | null; // null = a valid starting option
  toValue: string;
  typeKey?: string;         // omitted = applies to every type using the field
};

export type TypeLinkDef = { key: string; targetTypeKeys: string[] };

export type TypeDef = {
  key: string;
  label: string;
  config?: Record<string, unknown>; // color, icon
  placements: PlacementDef[];
  allowedChildTypes?: string[];
  linkKeys?: TypeLinkDef[];
};

export type LinkTypeDef = {
  key: string;
  label: string;
  inverseLabel: string;
  directional: boolean;
  ownerTypeKey: string;
  targetTypeKeys: string[];
};

export type ViewColumnDef =
  | { source: 'number' | 'type' | 'progress' }
  | { source: 'field'; fieldKey: string };

export type ViewDef = {
  name: string;
  columns: ViewColumnDef[];
  sort: { source: 'number' | 'field'; fieldKey?: string; dir: 'asc' | 'desc' };
};

export type SchemeDef = {
  key: string;
  name: string;
  optionSets: OptionSetDef[];
  fields: FieldDef[];
  types: TypeDef[];
  transitions: TransitionDef[];
  linkTypes: LinkTypeDef[];
  defaultView: ViewDef;
};
```

- [ ] **Step 2: Write the failing seed test**

`packages/db/src/seed/seed-scheme.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDbClient, type Db } from '../client';
import { fields, itemTypeFields, itemTypes, optionSets, options, optionTransitions } from '../schema';
import { seedScheme } from './seed-scheme';
import { softwareScheme } from './software-scheme';

describe('seedScheme (requires POSTGRES_DATABASE=tickets_dev)', () => {
  let db: Db;
  let sql: ReturnType<typeof createDbClient>['sql'];
  let seeded: Awaited<ReturnType<typeof seedScheme>>;

  beforeAll(async () => {
    ({ db, sql } = createDbClient({ max: 1 }));
    seeded = await seedScheme(db, softwareScheme);
  });
  afterAll(async () => { await sql.end(); });

  it('creates one shared status option set with lifecycle kinds', async () => {
    const [set] = await db.select().from(optionSets).where(eq(optionSets.key, 'status'));
    const rows = await db.select().from(options).where(eq(options.optionSetId, set!.id));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.every((o) => o.kind !== null)).toBe(true);
    expect(rows.some((o) => o.kind === 'done')).toBe(true);
  });

  it('gives non-workflow options a null kind', async () => {
    const [set] = await db.select().from(optionSets).where(eq(optionSets.key, 'priority'));
    const rows = await db.select().from(options).where(eq(options.optionSetId, set!.id));
    expect(rows.every((o) => o.kind === null)).toBe(true);
  });

  it('makes status a system option field, not a status type', async () => {
    const [status] = await db.select().from(fields).where(eq(fields.key, 'status'));
    expect(status!.type).toBe('option');
    expect(status!.system).toBe(true);
    expect(status!.optionSetId).not.toBeNull();
  });

  it('shares one field definition across types via placements', async () => {
    const statusId = seeded.fieldIdByKey.get('status')!;
    const placements = await db
      .select()
      .from(itemTypeFields)
      .where(eq(itemTypeFields.fieldId, statusId));
    expect(placements.length).toBe(seeded.typeIdByKey.size);
  });

  it('records each type\'s status subset as an allowlist on the placement', async () => {
    const statusId = seeded.fieldIdByKey.get('status')!;
    const epicId = seeded.typeIdByKey.get('epic')!;
    const [placement] = await db
      .select()
      .from(itemTypeFields)
      .where(eq(itemTypeFields.itemTypeId, epicId));
    const forStatus = await db
      .select()
      .from(itemTypeFields)
      .where(eq(itemTypeFields.fieldId, statusId));
    const epicPlacement = forStatus.find((p) => p.itemTypeId === epicId)!;
    const override = epicPlacement.configOverride as { allowedOptionIds?: number[] };
    expect(Array.isArray(override.allowedOptionIds)).toBe(true);
    expect(override.allowedOptionIds!.length).toBe(5); // epic has 5 statuses
  });

  it('writes the workflow graph into option_transitions', async () => {
    const rows = await db.select().from(optionTransitions);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((t) => t.fromOptionId === null)).toBe(true); // a valid start
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db test -- seed-scheme.test.ts
```

Expected: FAIL — `seedScheme` still writes `statuses`.

- [ ] **Step 4: Rewrite `software-scheme.ts`**

Define it to match the **live data** exactly (this is what makes seeded and imported schemes equivalent — spec §7). One `status` option set with the union of the 12 status keys, per-type subsets as allowlists:

```ts
import type { SchemeDef } from './scheme-types';

const STATUS_OPTIONS = [
  { value: 'triage',      label: 'Triage',      kind: 'todo' as const },
  { value: 'backlog',     label: 'Backlog',     kind: 'todo' as const },
  { value: 'todo',        label: 'To do',       kind: 'todo' as const },
  { value: 'in-progress', label: 'In progress', kind: 'active' as const },
  { value: 'in-review',   label: 'In review',   kind: 'active' as const },
  { value: 'merged',      label: 'Merged',      kind: 'active' as const },
  { value: 'deployed',    label: 'Deployed',    kind: 'active' as const },
  { value: 'blocked',     label: 'Blocked',     kind: 'blocked' as const },
  { value: 'done',        label: 'Done',        kind: 'done' as const },
  { value: 'fixed',       label: 'Fixed',       kind: 'done' as const },
  { value: 'cancelled',   label: 'Cancelled',   kind: 'dropped' as const },
  { value: 'wont-fix',    label: "Won't fix",   kind: 'dropped' as const },
];

export const softwareScheme: SchemeDef = {
  key: 'software',
  name: 'Software',
  optionSets: [
    { key: 'status', name: 'Status', options: STATUS_OPTIONS },
    {
      key: 'priority', name: 'Priority',
      options: [
        { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
        { value: 'trivial', label: 'Trivial' },
      ],
    },
    {
      key: 'kind', name: 'Kind',
      options: [
        { value: 'feat', label: 'Feature' }, { value: 'refactor', label: 'Refactor' },
        { value: 'perf', label: 'Performance' }, { value: 'chore', label: 'Chore' },
        { value: 'docs', label: 'Docs' }, { value: 'test', label: 'Test' },
      ],
    },
    {
      key: 'estimate', name: 'Estimate',
      options: [
        { value: 's', label: 'S' }, { value: 'm', label: 'M' },
        { value: 'l', label: 'L' }, { value: 'xl', label: 'XL' },
      ],
    },
    {
      key: 'severity', name: 'Severity',
      options: [
        { value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
        { value: 'cosmetic', label: 'Cosmetic' },
      ],
    },
    {
      key: 'environment', name: 'Environment',
      options: [
        { value: 'prod', label: 'Production' }, { value: 'staging', label: 'Staging' },
        { value: 'local', label: 'Local' },
      ],
    },
    { key: 'component', name: 'Component', options: [] }, // curated per project
    { key: 'labels', name: 'Labels', options: [] },
  ],
  fields: [
    { key: 'title',       label: 'Title',       type: 'string', system: true },
    { key: 'description', label: 'Description', type: 'string', config: { format: 'markdown' } },
    { key: 'status',      label: 'Status',      type: 'option', system: true,
      optionSetKey: 'status', config: { multiple: false, workflow: true } },
    { key: 'priority',    label: 'Priority',    type: 'option', optionSetKey: 'priority', config: { multiple: false } },
    { key: 'assignee',    label: 'Assignee',    type: 'user',   config: { multiple: false } },
    { key: 'labels',      label: 'Labels',      type: 'option', optionSetKey: 'labels', config: { multiple: true } },
    { key: 'component',   label: 'Component',   type: 'option', optionSetKey: 'component', config: { multiple: false } },
    { key: 'target_date', label: 'Target date', type: 'date' },
    { key: 'estimate',    label: 'Estimate',    type: 'option', optionSetKey: 'estimate', config: { multiple: false } },
    { key: 'pr',          label: 'PR',          type: 'string' },
    { key: 'environment', label: 'Environment', type: 'option', optionSetKey: 'environment', config: { multiple: false } },
    { key: 'findings',    label: 'Findings',    type: 'string', config: { format: 'markdown' } },
    { key: 'kind',        label: 'Kind',        type: 'option', optionSetKey: 'kind', config: { multiple: false } },
    { key: 'severity',    label: 'Severity',    type: 'option', optionSetKey: 'severity', config: { multiple: false } },
    { key: 'steps',       label: 'Steps',       type: 'string', config: { format: 'markdown' } },
  ],
  types: [
    {
      key: 'epic', label: 'Epic', config: { color: '#8f7ae8' },
      allowedChildTypes: ['task', 'bug', 'spike'],
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status',
          allowedOptionValues: ['backlog', 'in-progress', 'blocked', 'done', 'cancelled'] },
        { fieldKey: 'priority' }, { fieldKey: 'assignee' }, { fieldKey: 'component' },
        { fieldKey: 'labels' }, { fieldKey: 'target_date' },
      ],
    },
    {
      key: 'task', label: 'Task', config: { color: '#3987e5' },
      allowedChildTypes: ['subtask'],
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status',
          allowedOptionValues: ['backlog', 'todo', 'in-progress', 'in-review', 'merged', 'deployed', 'done', 'blocked', 'cancelled'] },
        { fieldKey: 'priority' }, { fieldKey: 'assignee' }, { fieldKey: 'component' },
        { fieldKey: 'labels' }, { fieldKey: 'estimate' }, { fieldKey: 'kind' }, { fieldKey: 'pr' },
      ],
    },
    {
      key: 'bug', label: 'Bug', config: { color: '#d03b3b' },
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status',
          allowedOptionValues: ['triage', 'todo', 'in-progress', 'in-review', 'merged', 'deployed', 'fixed', 'blocked', 'wont-fix'] },
        { fieldKey: 'priority' }, { fieldKey: 'assignee' }, { fieldKey: 'component' },
        { fieldKey: 'labels' }, { fieldKey: 'severity' }, { fieldKey: 'environment' },
        { fieldKey: 'steps' },
      ],
    },
    {
      key: 'spike', label: 'Spike', config: { color: '#e5a339' },
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status',
          allowedOptionValues: ['todo', 'in-progress', 'done', 'blocked', 'cancelled'] },
        { fieldKey: 'priority' }, { fieldKey: 'assignee' }, { fieldKey: 'component' },
        { fieldKey: 'labels' }, { fieldKey: 'target_date' }, { fieldKey: 'findings' },
      ],
    },
    {
      key: 'subtask', label: 'Subtask', config: { color: '#4aa3a3' },
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status',
          allowedOptionValues: ['todo', 'in-progress', 'in-review', 'done', 'blocked', 'cancelled'] },
        { fieldKey: 'priority' }, { fieldKey: 'assignee' }, { fieldKey: 'estimate' },
      ],
    },
  ],
  transitions: [
    // status is a shared field; a null typeKey means "every type using it".
    // Start states, per type:
    { fieldKey: 'status', fromValue: null, toValue: 'backlog',     typeKey: 'epic' },
    { fieldKey: 'status', fromValue: null, toValue: 'backlog',     typeKey: 'task' },
    { fieldKey: 'status', fromValue: null, toValue: 'triage',      typeKey: 'bug' },
    { fieldKey: 'status', fromValue: null, toValue: 'todo',        typeKey: 'spike' },
    { fieldKey: 'status', fromValue: null, toValue: 'todo',        typeKey: 'subtask' },
    // Everything else is unrestricted for now: an empty edge set for a
    // (field, type) pair means "any transition allowed", matching today's
    // status_transitions semantics.
  ],
  linkTypes: [
    { key: 'blocks',     label: 'Blocks',     inverseLabel: 'Blocked by',   directional: true,  ownerTypeKey: 'task', targetTypeKeys: ['task', 'bug', 'epic', 'spike', 'subtask'] },
    { key: 'relates-to', label: 'Relates to', inverseLabel: 'Relates to',   directional: false, ownerTypeKey: 'task', targetTypeKeys: ['task', 'bug', 'epic', 'spike', 'subtask'] },
    { key: 'duplicates', label: 'Duplicates', inverseLabel: 'Duplicated by', directional: true, ownerTypeKey: 'task', targetTypeKeys: ['task', 'bug'] },
  ],
  defaultView: {
    name: 'All items',
    columns: [
      { source: 'number' }, { source: 'type' },
      { source: 'field', fieldKey: 'title' },
      { source: 'field', fieldKey: 'status' },
      { source: 'field', fieldKey: 'priority' },
      { source: 'field', fieldKey: 'assignee' },
    ],
    sort: { source: 'number', dir: 'desc' },
  },
};
```

- [ ] **Step 5: Rewrite `seed-scheme.ts`**

Insert in dependency order and return the id maps:

```ts
import type { Db } from '../client';
import {
  fields, itemTypeChildTypes, itemTypeFields, itemTypes, linkTypeTargetTypes, linkTypes,
  optionSets, optionTransitions, options, schemes,
} from '../schema';
import type { SchemeDef } from './scheme-types';

export type SeededScheme = {
  schemeId: number;
  typeIdByKey: Map<string, number>;
  fieldIdByKey: Map<string, number>;
  optionSetIdByKey: Map<string, number>;
  // key is `${optionSetKey}:${optionValue}`
  optionIdByKey: Map<string, number>;
};

export async function seedScheme(db: Db, def: SchemeDef): Promise<SeededScheme> {
  const [scheme] = await db
    .insert(schemes)
    .values({ key: def.key, name: def.name })
    .returning();
  const schemeId = scheme!.id;

  const optionSetIdByKey = new Map<string, number>();
  const optionIdByKey = new Map<string, number>();
  for (const set of def.optionSets) {
    const [row] = await db
      .insert(optionSets)
      .values({ schemeId, key: set.key, name: set.name })
      .returning();
    optionSetIdByKey.set(set.key, row!.id);
    if (set.options.length === 0) continue;              // labels/component start empty
    const inserted = await db
      .insert(options)
      .values(
        set.options.map((o, position) => ({
          optionSetId: row!.id,
          value: o.value,
          label: o.label,
          position,
          kind: o.kind ?? null,
          config: o.config ?? {},
        })),
      )
      .returning();
    inserted.forEach((o) => optionIdByKey.set(`${set.key}:${o.value}`, o.id));
  }

  const fieldIdByKey = new Map<string, number>();
  for (const f of def.fields) {
    const [row] = await db
      .insert(fields)
      .values({
        schemeId,
        key: f.key,
        label: f.label,
        type: f.type,
        system: f.system ?? false,
        config: f.config ?? {},
        optionSetId: f.optionSetKey ? optionSetIdByKey.get(f.optionSetKey)! : null,
      })
      .returning();
    fieldIdByKey.set(f.key, row!.id);
  }

  const typeIdByKey = new Map<string, number>();
  for (const [position, t] of def.types.entries()) {
    const [row] = await db
      .insert(itemTypes)
      .values({ schemeId, key: t.key, label: t.label, position, config: t.config ?? {} })
      .returning();
    typeIdByKey.set(t.key, row!.id);
  }

  for (const t of def.types) {
    const itemTypeId = typeIdByKey.get(t.key)!;
    await db.insert(itemTypeFields).values(
      t.placements.map((p, position) => {
        const field = def.fields.find((f) => f.key === p.fieldKey)!;
        const allowed = p.allowedOptionValues?.map(
          (v) => optionIdByKey.get(`${field.optionSetKey}:${v}`)!,
        );
        return {
          itemTypeId,
          fieldId: fieldIdByKey.get(p.fieldKey)!,
          position,
          required: p.required ?? false,
          configOverride: allowed ? { allowedOptionIds: allowed } : null,
        };
      }),
    );
    if (t.allowedChildTypes?.length) {
      await db.insert(itemTypeChildTypes).values(
        t.allowedChildTypes.map((childKey) => ({
          parentTypeId: itemTypeId,
          childTypeId: typeIdByKey.get(childKey)!,
        })),
      );
    }
  }

  if (def.transitions.length) {
    await db.insert(optionTransitions).values(
      def.transitions.map((tr) => {
        const field = def.fields.find((f) => f.key === tr.fieldKey)!;
        return {
          fieldId: fieldIdByKey.get(tr.fieldKey)!,
          fromOptionId: tr.fromValue
            ? optionIdByKey.get(`${field.optionSetKey}:${tr.fromValue}`)!
            : null,
          toOptionId: optionIdByKey.get(`${field.optionSetKey}:${tr.toValue}`)!,
          itemTypeId: tr.typeKey ? typeIdByKey.get(tr.typeKey)! : null,
        };
      }),
    );
  }

  for (const [position, lt] of def.linkTypes.entries()) {
    const [row] = await db
      .insert(linkTypes)
      .values({
        itemTypeId: typeIdByKey.get(lt.ownerTypeKey)!,
        key: lt.key,
        label: lt.label,
        inverseLabel: lt.inverseLabel,
        directional: lt.directional,
        position,
      })
      .returning();
    await db.insert(linkTypeTargetTypes).values(
      lt.targetTypeKeys.map((k) => ({
        linkTypeId: row!.id,
        targetTypeId: typeIdByKey.get(k)!,
      })),
    );
  }

  return { schemeId, typeIdByKey, fieldIdByKey, optionSetIdByKey, optionIdByKey };
}
```

Update `ensure-software-scheme.ts`, `seed-project.ts` and `verify-scheme.ts` to the new tables and the `SeededScheme` return. Delete `build-transitions.ts` and `build-transitions.test.ts` — transitions are now declared directly in `SchemeDef.transitions`, so the builder has no job.

- [ ] **Step 6: Run the seed tests**

```bash
docker exec tickets-postgres-1 psql -U postgres -c "DROP DATABASE tickets_dev;"
docker exec tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_dev;"
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db db:migrate
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db test -- seed-scheme.test.ts
```

Expected: PASS, all 6.

- [ ] **Step 7: Commit**

```bash
git add -A packages/db/src/seed
git commit -m "feat(db): seed the items vocabulary — shared option sets, placements, transitions

status is a system option field over one shared 12-option set; each type's
subset is an allowlist in item_type_fields.config_override. The workflow graph
lives in option_transitions. build-transitions is gone — SchemeDef declares
transitions directly."
```

---

## Task 8: Restore the backup into `tickets_legacy`

The importer reads the OLD schema, which no longer exists in code. Restore it into a throwaway database and read it with raw SQL.

**Files:**
- Create: `packages/db/src/import/legacy-client.ts`, `packages/db/src/import/read-legacy.ts`
- Test: `packages/db/src/import/read-legacy.test.ts`
- Modify: `packages/db/package.json` (scripts)

**Interfaces:**
- Produces: `createLegacyClient(): { sql: Sql }` and the readers `readLegacy(sql): Promise<Legacy>` where

```ts
type Legacy = {
  users: LegacyUser[]; projects: LegacyProject[]; ticketTypes: LegacyTicketType[];
  ticketTypeChildTypes: { parentTypeId: number; childTypeId: number }[];
  fields: LegacyField[]; fieldOptions: LegacyFieldOption[];
  statuses: LegacyStatus[]; statusTransitions: LegacyStatusTransition[];
  linkTypes: LegacyLinkType[]; linkTypeTargetTypes: { linkTypeId: number; targetTypeId: number }[];
  tickets: LegacyTicket[]; ticketValues: LegacyTicketValue[];
  comments: LegacyComment[]; commentReactions: LegacyReaction[];
  ticketLinks: LegacyLink[]; ticketEvents: LegacyEvent[]; views: LegacyView[];
};
```

Every `Legacy*` row type is the old table's columns, camelCased. Tasks 9–11 consume this.

- [ ] **Step 1: Restore the backup**

```bash
docker exec tickets-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS tickets_legacy;"
docker exec tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_legacy;"
docker exec -i tickets-postgres-1 pg_restore -U postgres -d tickets_legacy --no-owner < backups/tickets-2026-07-14.dump
docker exec tickets-postgres-1 psql -U postgres -d tickets_legacy -c "SELECT count(*) FROM tickets;"
```

Expected: `635`.

- [ ] **Step 2: Write the failing reader test**

`packages/db/src/import/read-legacy.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLegacyClient } from './legacy-client';
import { readLegacy, type Legacy } from './read-legacy';

describe('readLegacy (requires tickets_legacy restored — see Task 8 Step 1)', () => {
  let close: () => Promise<void>;
  let legacy: Legacy;

  beforeAll(async () => {
    const { sql } = createLegacyClient();
    close = () => sql.end();
    legacy = await readLegacy(sql);
  });
  afterAll(async () => { await close(); });

  it('reads the live counts', () => {
    expect(legacy.projects).toHaveLength(5);
    expect(legacy.tickets).toHaveLength(635);
    expect(legacy.ticketValues).toHaveLength(2948);
    expect(legacy.comments).toHaveLength(139);
    expect(legacy.ticketLinks).toHaveLength(191);
    expect(legacy.ticketEvents).toHaveLength(1523);
    expect(legacy.fields).toHaveLength(46);
    expect(legacy.statuses).toHaveLength(34);
    expect(legacy.ticketTypes).toHaveLength(5);
  });

  it('carries the type-owned field shape', () => {
    const title = legacy.fields.find((f) => f.key === 'title')!;
    expect(title.ticketTypeId).toBeGreaterThan(0);
    expect(title.type).toBe('text');
    expect(typeof title.position).toBe('number');
  });

  it('carries status kinds', () => {
    expect(legacy.statuses.every((s) => s.kind !== null)).toBe(true);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
pnpm --filter @tickets/db test -- read-legacy.test.ts
```

Expected: FAIL — `Cannot find module './legacy-client'`.

- [ ] **Step 4: Write the client and readers**

`packages/db/src/import/legacy-client.ts`:

```ts
// packages/db/src/import/legacy-client.ts
// Raw postgres client for the pre-rebuild schema. No drizzle — those tables no
// longer exist in code. Restore the backup into tickets_legacy first.
import postgres, { type Sql } from 'postgres';
import { environment } from '../environment';

export const LEGACY_DATABASE = process.env.LEGACY_DATABASE ?? 'tickets_legacy';

export function createLegacyClient(): { sql: Sql } {
  const { host, port, user, password } = environment.postgres;
  return {
    sql: postgres(`postgres://${user}:${password}@${host}:${port}/${LEGACY_DATABASE}`, { max: 1 }),
  };
}
```

`packages/db/src/import/read-legacy.ts` — one query per table, all columns, camelCased via postgres-js's `transform`. Define the `Legacy*` types exactly as the old columns, then:

```ts
import type { Sql } from 'postgres';

export type LegacyUser = { id: number; name: string; kind: 'human' | 'agent' };
export type LegacyProject = { id: number; key: string; name: string; ticketPrefix: string; schemeId: number; createdAt: string };
export type LegacyTicketType = { id: number; schemeId: number; key: string; label: string; position: number; config: unknown; archivedAt: string | null; createdAt: string };
export type LegacyField = { id: number; ticketTypeId: number; position: number; required: boolean; key: string; label: string; type: string; system: boolean; config: Record<string, unknown>; archivedAt: string | null };
export type LegacyFieldOption = { id: number; fieldId: number; value: string; label: string; position: number; config: Record<string, unknown>; archivedAt: string | null };
export type LegacyStatus = { id: number; ticketTypeId: number; key: string; label: string; kind: 'todo' | 'active' | 'blocked' | 'done' | 'dropped'; config: Record<string, unknown>; position: number; archivedAt: string | null };
export type LegacyStatusTransition = { id: number; fromStatusId: number | null; toStatusId: number; ticketTypeId: number | null };
export type LegacyLinkType = { id: number; ticketTypeId: number; key: string; label: string; inverseLabel: string; directional: boolean; position: number; archivedAt: string | null };
export type LegacyTicket = { id: number; projectId: number; typeId: number; parentId: number | null; number: number; createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string };
export type LegacyTicketValue = { id: number; ticketId: number; fieldId: number; valueText: string | null; valueNumber: string | null; valueDate: string | null; valueBool: boolean | null; valueJson: unknown; optionId: number | null; statusId: number | null };
export type LegacyComment = { id: number; ticketId: number; authorId: number; parentId: number | null; body: string; createdAt: string };
export type LegacyReaction = { id: number; commentId: number; userId: number; emoji: string; createdAt: string };
export type LegacyLink = { id: number; linkTypeId: number; sourceTicketId: number; targetTicketId: number; createdAt: string };
export type LegacyEvent = { id: number; ticketId: number; actorId: number; kind: string; payload: Record<string, unknown>; createdAt: string };
export type LegacyView = { id: number; projectId: number; name: string; config: Record<string, unknown>; position: number; archivedAt: string | null; createdAt: string };

export type Legacy = {
  users: LegacyUser[]; projects: LegacyProject[]; ticketTypes: LegacyTicketType[];
  ticketTypeChildTypes: { parentTypeId: number; childTypeId: number }[];
  fields: LegacyField[]; fieldOptions: LegacyFieldOption[];
  statuses: LegacyStatus[]; statusTransitions: LegacyStatusTransition[];
  linkTypes: LegacyLinkType[]; linkTypeTargetTypes: { linkTypeId: number; targetTypeId: number }[];
  tickets: LegacyTicket[]; ticketValues: LegacyTicketValue[];
  comments: LegacyComment[]; commentReactions: LegacyReaction[];
  ticketLinks: LegacyLink[]; ticketEvents: LegacyEvent[]; views: LegacyView[];
};

const camel = <T>(rows: Record<string, unknown>[]): T[] =>
  rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
    }
    return out as T;
  });

export async function readLegacy(sql: Sql): Promise<Legacy> {
  const q = async <T>(table: string, order = 'id'): Promise<T[]> =>
    camel<T>(await sql.unsafe(`SELECT * FROM ${table} ORDER BY ${order}`));

  return {
    users: await q<LegacyUser>('users'),
    projects: await q<LegacyProject>('projects'),
    ticketTypes: await q<LegacyTicketType>('ticket_types'),
    ticketTypeChildTypes: await q('ticket_type_child_types', 'parent_type_id, child_type_id'),
    fields: await q<LegacyField>('fields'),
    fieldOptions: await q<LegacyFieldOption>('field_options'),
    statuses: await q<LegacyStatus>('statuses'),
    statusTransitions: await q<LegacyStatusTransition>('status_transitions'),
    linkTypes: await q<LegacyLinkType>('link_types'),
    linkTypeTargetTypes: await q('link_type_target_types', 'link_type_id, target_type_id'),
    tickets: await q<LegacyTicket>('tickets'),
    ticketValues: await q<LegacyTicketValue>('ticket_values'),
    comments: await q<LegacyComment>('comments'),
    commentReactions: await q<LegacyReaction>('comment_reactions'),
    ticketLinks: await q<LegacyLink>('ticket_links'),
    ticketEvents: await q<LegacyEvent>('ticket_events', 'ticket_id, created_at, id'),
    views: await q<LegacyView>('views'),
  };
}
```

- [ ] **Step 5: Run the tests**

```bash
pnpm --filter @tickets/db test -- read-legacy.test.ts
```

Expected: PASS — the counts are the live ones.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/import
git commit -m "feat(db): read the pre-rebuild schema from a tickets_legacy restore

Raw SQL, no drizzle — the ticket* tables are gone from code. Counts assert the
restore is the real thing: 635 items, 2948 values, 1523 events."
```

---

## Task 9: Map the structure (46 fields → 15 + 46 placements)

The pure transform, with no database writes — so it can be tested exhaustively and fail loudly on the invariants the live data satisfies.

**Files:**
- Create: `packages/db/src/import/map-structure.ts`
- Test: `packages/db/src/import/map-structure.test.ts`

**Interfaces:**
- Consumes: `Legacy` (Task 8).
- Produces:

```ts
export type StructurePlan = {
  optionSets: { key: string; name: string; options: { value: string; label: string; position: number; kind: StatusKind | null; config: Record<string, unknown> }[] }[];
  fields: { key: string; label: string; type: FieldType; system: boolean; config: Record<string, unknown>; optionSetKey: string | null }[];
  placements: { typeKey: string; fieldKey: string; position: number; required: boolean; allowedOptionValues: string[] | null }[];
  transitions: { fieldKey: string; fromValue: string | null; toValue: string; typeKey: string | null }[];
  agentUserNames: string[];
  // legacy field id -> new field key (for remapping event payloads + views.config)
  fieldKeyByLegacyId: Map<number, string>;
  // legacy option/status id -> `${optionSetKey}:${value}`
  optionKeyByLegacyOptionId: Map<number, string>;
  optionKeyByLegacyStatusId: Map<number, string>;
};
```

Task 10 and Task 11 both consume the three maps.

- [ ] **Step 1: Write the failing test**

`packages/db/src/import/map-structure.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLegacyClient } from './legacy-client';
import { readLegacy, type Legacy } from './read-legacy';
import { mapStructure, type StructurePlan } from './map-structure';

describe('mapStructure', () => {
  let close: () => Promise<void>;
  let plan: StructurePlan;

  beforeAll(async () => {
    const { sql } = createLegacyClient();
    close = () => sql.end();
    const legacy: Legacy = await readLegacy(sql);
    plan = mapStructure(legacy);
  });
  afterAll(async () => { await close(); });

  it('collapses 46 field definitions into 15 library fields', () => {
    expect(plan.fields).toHaveLength(15);
    expect(plan.fields.map((f) => f.key).sort()).toEqual([
      'assignee', 'component', 'description', 'environment', 'estimate', 'findings',
      'kind', 'labels', 'pr', 'priority', 'severity', 'status', 'steps', 'target_date', 'title',
    ]);
  });

  it('keeps all 46 placements', () => {
    expect(plan.placements).toHaveLength(46);
  });

  it('produces 8 option sets and 114 options', () => {
    expect(plan.optionSets).toHaveLength(8);
    const total = plan.optionSets.reduce((n, s) => n + s.options.length, 0);
    expect(total).toBe(114);
  });

  it('merges 34 statuses into one 12-option status set with lifecycle kinds', () => {
    const status = plan.optionSets.find((s) => s.key === 'status')!;
    expect(status.options).toHaveLength(12);
    expect(status.options.every((o) => o.kind !== null)).toBe(true);
    expect(status.options.find((o) => o.value === 'wont-fix')!.kind).toBe('dropped');
    expect(status.options.find((o) => o.value === 'fixed')!.kind).toBe('done');
  });

  it('gives labels an empty option set rather than no option set', () => {
    const labels = plan.optionSets.find((s) => s.key === 'labels')!;
    expect(labels.options).toHaveLength(0);
    expect(plan.fields.find((f) => f.key === 'labels')!.optionSetKey).toBe('labels');
  });

  it('records each type\'s status subset as an allowlist', () => {
    const epic = plan.placements.find((p) => p.typeKey === 'epic' && p.fieldKey === 'status')!;
    expect(epic.allowedOptionValues).toEqual(
      expect.arrayContaining(['backlog', 'in-progress', 'blocked', 'done', 'cancelled']),
    );
    expect(epic.allowedOptionValues).toHaveLength(5);
    const bug = plan.placements.find((p) => p.typeKey === 'bug' && p.fieldKey === 'status')!;
    expect(bug.allowedOptionValues).toHaveLength(9);
  });

  it('upgrades assignee to a user field and names the agents to create', () => {
    const assignee = plan.fields.find((f) => f.key === 'assignee')!;
    expect(assignee.type).toBe('user');
    expect(assignee.optionSetKey).toBeNull();
    expect(plan.agentUserNames.sort()).toEqual([
      'claude-fable-5', 'claude-haiku-4-5', 'claude-opus-4-8', 'claude-sonnet-5',
    ]);
  });

  it('maps the old field types onto the new enum', () => {
    const byKey = new Map(plan.fields.map((f) => [f.key, f]));
    expect(byKey.get('title')!.type).toBe('string');
    expect(byKey.get('status')!.type).toBe('option');
    expect(byKey.get('status')!.config).toMatchObject({ multiple: false, workflow: true });
    expect(byKey.get('labels')!.type).toBe('option');
    expect(byKey.get('labels')!.config).toMatchObject({ multiple: true });
    expect(byKey.get('priority')!.config).toMatchObject({ multiple: false });
    expect(byKey.get('target_date')!.type).toBe('date');
  });

  it('maps every legacy field id to a key', () => {
    expect(plan.fieldKeyByLegacyId.size).toBe(46);
  });

  it('maps every legacy status id and option id', () => {
    expect(plan.optionKeyByLegacyStatusId.size).toBe(34);
    expect(plan.optionKeyByLegacyOptionId.size).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @tickets/db test -- map-structure.test.ts
```

Expected: FAIL — no `./map-structure`.

- [ ] **Step 3: Implement `map-structure.ts`**

Key rules, in order:

1. **Assert the invariants first, loudly.** Group legacy fields by `key`; throw if a key has more than one distinct `type`, or if its option-value list differs across types. Group statuses by `key`; throw if a key has more than one `kind`. (Spec §6.2 — the live data satisfies all of this; a violation means the data changed and the merge is unsafe.)
2. **Field types:** `text`→`string`, `date`→`date`, `number`→`number`, `boolean`→`boolean`, `json`→`json`, `select`→`option` + `{multiple:false}`, `multi_select`→`option` + `{multiple:true}`, `status`→`option` + `{multiple:false, workflow:true}`. Then override: `assignee` → `user` + `{multiple:false}`, `optionSetKey: null`.
3. **`config.format`:** `markdown` on `description`, `findings`, `steps`.
4. **Option sets:** one per option-typed field key (using that key as the set key), built from the *first* type's `field_options` (they are identical across types — asserted in rule 1). `labels` gets an empty set. `assignee` gets **no** set — its 4 option values become `agentUserNames`.
5. **The status set:** the union of all 34 statuses keyed by `key`, ordered by first appearance, each carrying its `kind`. Each type's placement gets `allowedOptionValues` = that type's own status keys.
6. **Placements:** one per legacy field row — `typeKey` from its `ticketTypeId`, `position` and `required` carried across.
7. **Transitions:** each legacy `status_transitions` row → `{ fieldKey: 'status', fromValue, toValue, typeKey }`, resolving status ids to values through `optionKeyByLegacyStatusId`. A row with `ticketTypeId: null` maps to `typeKey: null`.
8. **The maps:** `fieldKeyByLegacyId` for all 46; `optionKeyByLegacyOptionId` and `optionKeyByLegacyStatusId` in `` `${setKey}:${value}` `` form.

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @tickets/db test -- map-structure.test.ts
```

Expected: PASS, all 10.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/import/map-structure.ts packages/db/src/import/map-structure.test.ts
git commit -m "feat(db): map the legacy structure — 46 fields to 15, 34 statuses to 12

Pure transform, asserts its invariants: a field key with two types, or a status
key with two lifecycle kinds, throws rather than guessing. assignee becomes a
user field; labels gets an empty option set."
```

---

## Task 10: Import the records

**Files:**
- Create: `packages/db/src/import/import-legacy.ts`
- Modify: `packages/db/package.json` — add `"db:import": "tsx src/import/run-import.ts"`
- Create: `packages/db/src/import/run-import.ts`
- Test: `packages/db/src/import/import-legacy.test.ts`

**Interfaces:**
- Consumes: `readLegacy` (Task 8), `mapStructure` (Task 9), `seedScheme`'s `SeededScheme` shape (Task 7).
- Produces: `importLegacy(db, legacy): Promise<ImportResult>` where `ImportResult = { schemeId: number; fieldIdByLegacyId: Map<number, number>; optionIdByLegacyOptionId: Map<number, number>; optionIdByLegacyStatusId: Map<number, number>; userIdByAgentName: Map<string, number> }`. Task 11 consumes `fieldIdByLegacyId`.

- [ ] **Step 1: Write the failing test**

`packages/db/src/import/import-legacy.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql as raw } from 'drizzle-orm';
import { createDbClient, type Db } from '../client';
import { fields, itemValues, items, options, users } from '../schema';
import { createLegacyClient } from './legacy-client';
import { importLegacy } from './import-legacy';
import { readLegacy } from './read-legacy';

describe('importLegacy (requires a freshly migrated tickets_dev)', () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const target = createDbClient({ max: 1 });
    const legacyClient = createLegacyClient();
    db = target.db;
    close = async () => { await target.sql.end(); await legacyClient.sql.end(); };
    const legacy = await readLegacy(legacyClient.sql);
    await importLegacy(db, legacy);
  }, 120_000);
  afterAll(async () => { await close(); });

  it('imports every item, preserving ids', async () => {
    const rows = await db.select().from(items);
    expect(rows).toHaveLength(635);
    expect(rows.some((i) => i.id === 1)).toBe(true);
  });

  it('imports every value', async () => {
    const rows = await db.select().from(itemValues);
    expect(rows).toHaveLength(2948);
  });

  it('puts assignee values in value_user_id, not option_id', async () => {
    const [assignee] = await db.select().from(fields).where(eq(fields.key, 'assignee'));
    const rows = await db.select().from(itemValues).where(eq(itemValues.fieldId, assignee!.id));
    expect(rows).toHaveLength(347);
    expect(rows.every((r) => r.valueUserId !== null && r.optionId === null)).toBe(true);
  });

  it('creates the 4 agent users and leaves the original 3 alone', async () => {
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(7);
    expect(rows.filter((u) => u.name === 'claude')).toHaveLength(1);
    expect(rows.some((u) => u.name === 'claude-sonnet-5' && u.kind === 'agent')).toBe(true);
  });

  it('stores status as an option value with a lifecycle kind', async () => {
    const [status] = await db.select().from(fields).where(eq(fields.key, 'status'));
    const rows = await db.select().from(itemValues).where(eq(itemValues.fieldId, status!.id));
    expect(rows).toHaveLength(635);
    expect(rows.every((r) => r.optionId !== null)).toBe(true);
    const opts = await db.select().from(options);
    const byId = new Map(opts.map((o) => [o.id, o]));
    expect(rows.every((r) => byId.get(r.optionId!)!.kind !== null)).toBe(true);
  });

  it('resets sequences so new inserts do not collide with preserved ids', async () => {
    const [{ next }] = await db.execute<{ next: number }>(
      raw`SELECT nextval(pg_get_serial_sequence('items', 'id')) AS next`,
    );
    expect(Number(next)).toBeGreaterThan(635);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db test -- import-legacy.test.ts
```

Expected: FAIL — no `./import-legacy`.

- [ ] **Step 3: Implement `import-legacy.ts`**

One transaction, in FK dependency order. **Structure first, then records.**

1. **users** — insert the 3 legacy users with explicit ids; then insert the 4 `agentUserNames` (`kind: 'agent'`) and record `userIdByAgentName`.
2. **scheme** — one row (`key: 'software'`, from the legacy `schemes` row).
3. **option_sets + options** — from `plan.optionSets`; build `optionIdByLegacyOptionId` and `optionIdByLegacyStatusId` by resolving each `` `${setKey}:${value}` `` to the inserted id.
4. **fields** — from `plan.fields`; build `fieldIdByLegacyId` via `plan.fieldKeyByLegacyId`.
5. **item_types** (explicit ids), **item_type_child_types**, **item_type_fields** (mapping `allowedOptionValues` → `configOverride.allowedOptionIds`).
6. **option_transitions** — from `plan.transitions`.
7. **link_types** (explicit ids, `ticketTypeId`→`itemTypeId`) + **link_type_target_types**.
8. **projects** (explicit ids, `ticketPrefix`→`itemPrefix`).
9. **items** (explicit ids) — `parentId` preserved. Insert parents before children, or defer the FK: order by `parent_id NULLS FIRST`.
10. **item_values** — for each legacy row: resolve `fieldId` through `fieldIdByLegacyId`; then
    - `statusId` set → `optionId` = `optionIdByLegacyStatusId.get(statusId)`
    - `optionId` set, field is `assignee` → `valueUserId` = the agent user for that option's value
    - `optionId` set, otherwise → `optionId` = `optionIdByLegacyOptionId.get(optionId)`
    - scalars copy across unchanged.
11. **comments** (explicit ids, parents first), **comment_reactions**, **item_links** (explicit ids).
12. **views** — remap `config`'s field ids through `fieldIdByLegacyId`.
13. **Reset every serial sequence** so the next insert does not collide with a preserved id:

```ts
const SEQUENCED = ['users', 'projects', 'schemes', 'item_types', 'fields', 'option_sets',
  'options', 'option_transitions', 'link_types', 'items', 'item_values', 'comments',
  'comment_reactions', 'item_links', 'views'];
for (const table of SEQUENCED) {
  await tx.execute(raw`
    SELECT setval(pg_get_serial_sequence(${table}, 'id'),
                  COALESCE((SELECT MAX(id) FROM ${raw.identifier(table)}), 0) + 1, false)
  `);
}
```

`run-import.ts` is a thin entry point: open both clients, `readLegacy`, `importLegacy`, close, log the counts.

- [ ] **Step 4: Run the tests**

```bash
docker exec tickets-postgres-1 psql -U postgres -c "DROP DATABASE tickets_dev;"
docker exec tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_dev;"
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db db:migrate
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db test -- import-legacy.test.ts
```

Expected: PASS, all 6.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/import packages/db/package.json
git commit -m "feat(db): import the legacy records into the items schema

635 items, 2948 values, 139 comments, 191 links. Ids preserved for items,
comments, links, users and projects; fields and options get new ids and every
reference is remapped. status_id becomes option_id; assignee becomes
value_user_id against 4 new agent users. Sequences reset after explicit ids."
```

---

## Task 11: Import the history

**Files:**
- Create: `packages/db/src/import/kind-map.ts`, `packages/db/src/import/import-history.ts`
- Test: `packages/db/src/import/import-history.test.ts`
- Modify: `packages/db/src/import/import-legacy.ts` (call `importHistory` at the end)

**Interfaces:**
- Consumes: `Legacy` (Task 8), `ImportResult.fieldIdByLegacyId` (Task 10).
- Produces: `importHistory(tx, legacy, ids): Promise<void>`.

- [ ] **Step 1: Write the failing test**

`packages/db/src/import/import-history.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql as raw } from 'drizzle-orm';
import { createDbClient, type Db } from '../client';
import { commands, events, itemActivity, outbox } from '../schema';

describe('imported history (run after import-legacy.test.ts)', () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const c = createDbClient({ max: 1 });
    db = c.db;
    close = () => c.sql.end();
  });
  afterAll(async () => { await close(); });

  it('imports all 1523 legacy events plus one baseline per item', async () => {
    const rows = await db.select().from(events);
    expect(rows).toHaveLength(1523 + 635);
  });

  it('marks legacy events version 0 and maps every kind', async () => {
    const legacy = await db.select().from(events).where(eq(events.version, 0));
    expect(legacy).toHaveLength(1523);
    const kinds = new Set(legacy.map((e) => e.kind));
    expect([...kinds].sort()).toEqual([
      'item.archived', 'item.comment_added', 'item.created', 'item.field_changed',
      'item.link_added', 'item.link_removed', 'item.reparented', 'item.unarchived',
    ]);
  });

  it('puts the item.imported baseline LAST in every stream', async () => {
    const [{ bad }] = await db.execute<{ bad: number }>(raw`
      SELECT count(*)::int AS bad FROM events e
      WHERE e.kind = 'item.imported'
        AND EXISTS (
          SELECT 1 FROM events later
          WHERE later.aggregate_type = 'item' AND later.aggregate_id = e.aggregate_id
            AND later.seq > e.seq)
    `);
    expect(bad).toBe(0);
  });

  it('gives every item exactly one baseline', async () => {
    const rows = await db.select().from(events).where(eq(events.kind, 'item.imported'));
    expect(rows).toHaveLength(635);
    expect(rows.every((r) => r.version === 1)).toBe(true);
  });

  it('remaps fieldId in legacy payloads to the NEW field ids', async () => {
    const changed = await db
      .select()
      .from(events)
      .where(and(eq(events.kind, 'item.field_changed'), eq(events.version, 0)));
    expect(changed.length).toBe(48); // 45 status-changed + 3 value-changed
    const [{ orphans }] = await db.execute<{ orphans: number }>(raw`
      SELECT count(*)::int AS orphans FROM events e
      WHERE e.kind = 'item.field_changed' AND e.version = 0
        AND NOT EXISTS (SELECT 1 FROM fields f WHERE f.id = (e.payload->>'fieldId')::int)
    `);
    expect(orphans).toBe(0);
  });

  it('numbers seq from 1 with no gaps per stream', async () => {
    const [{ bad }] = await db.execute<{ bad: number }>(raw`
      SELECT count(*)::int AS bad FROM (
        SELECT aggregate_id, count(*) AS n, max(seq) AS hi, min(seq) AS lo
        FROM events WHERE aggregate_type = 'item' GROUP BY aggregate_id
      ) s WHERE s.lo <> 1 OR s.hi <> s.n
    `);
    expect(bad).toBe(0);
  });

  it('leaves outbox, commands and item_activity empty', async () => {
    expect(await db.select().from(outbox)).toHaveLength(0);
    expect(await db.select().from(commands)).toHaveLength(0);
    expect(await db.select().from(itemActivity)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db test -- import-history.test.ts
```

Expected: FAIL — `events` is empty.

- [ ] **Step 3: Write the kind map**

`packages/db/src/import/kind-map.ts` — these are the exact 9 kinds in the live data:

```ts
// packages/db/src/import/kind-map.ts
// The nine free-text kinds the old audit trail emitted, and their new names.
// These rows import as version 0: lossy, display-only, never folded.
export const LEGACY_KIND_MAP: Record<string, string> = {
  created: 'item.created',            // payload { values: { fieldKey: value } }
  archived: 'item.archived',          // payload {}
  unarchived: 'item.unarchived',      // payload {}
  commented: 'item.comment_added',    // payload { commentId }
  'parent-changed': 'item.reparented',// payload { from, to } — item ids, still valid
  'status-changed': 'item.field_changed', // payload { fieldId, fieldKey, from, to }
  'value-changed': 'item.field_changed',  // payload { fieldId, fieldKey, from, to }
  'link-added': 'item.link_added',    // payload { linkId, linkTypeKey }
  'link-removed': 'item.link_removed',// payload { linkId }
};

export function mapKind(legacy: string): string {
  const mapped = LEGACY_KIND_MAP[legacy];
  if (!mapped) throw new Error(`unmapped legacy event kind "${legacy}"`);
  return mapped;
}
```

- [ ] **Step 4: Implement `import-history.ts`**

For each item, in `(created_at, id)` order:

1. Emit each legacy event with `aggregateType: 'item'`, `aggregateId` = the item id, `seq` = 1..n, `kind` = `mapKind(...)`, `version: 0`, `actorId` = the legacy `actorId`, `at` = the legacy `createdAt`, a fresh `crypto.randomUUID()` used for **both** `commandId` and `correlationId`, `causedBy: null`, `depth: 0`, `projectId` from the item.
2. **Remap `payload.fieldId`.** `status-changed` and `value-changed` carry the *legacy* field id, which after the 46→15 dedup would point at an unrelated new field. Rewrite it through `fieldIdByLegacyId` and keep `fieldKey` as-is. Every other payload key survives untouched (`linkId`, `commentId`, `from`/`to` on `parent-changed` are item ids, all of which keep their ids).
3. Append `item.imported` at `seq = n + 1`, `version: 1`, `actorId` = the `migration` user, `at` = now, payload = the item's full snapshot:

```ts
{
  projectId, typeId, number, parentId,
  values: [{ fieldKey, type, value }],  // every item_value, as the new value types
}
```

This is the lossless baseline: **a rebuild starts at the newest `item.imported`** and folds forward; everything before it is `version: 0` and display-only.

Call `importHistory(tx, legacy, ids)` as the final step of `importLegacy`'s transaction. Write **nothing** to `outbox`, `commands` or `item_activity` (spec §6.3).

- [ ] **Step 5: Run the tests**

```bash
docker exec tickets-postgres-1 psql -U postgres -c "DROP DATABASE tickets_dev;"
docker exec tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_dev;"
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db db:migrate
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db test -- import-legacy.test.ts import-history.test.ts
```

Expected: PASS, all 13.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/import
git commit -m "feat(db): import legacy history as version-0, display-only events

1523 events with their nine free-text kinds mapped to item.*; payload fieldIds
remapped to the new field ids (they would otherwise point at unrelated fields
after the 46->15 dedup). One item.imported baseline appended LAST per stream —
a rebuild starts there and folds forward; anything earlier is unfoldable.

outbox, commands and item_activity stay empty: imported history must never
fire a consumer."
```

---

## Task 12: Verify the import against the source

Counts prove nothing about correctness. This compares the **logical state of every item**, old vs new, and is the gate for the whole plan.

**Files:**
- Create: `packages/db/src/import/verify-import.ts`, `packages/db/src/import/run-verify.ts`
- Test: `packages/db/src/import/verify-import.test.ts`
- Modify: `packages/db/package.json` — add `"db:verify-import": "tsx src/import/run-verify.ts"`
- Modify: `docs/database.md` (rewrite for the new schema)

**Interfaces:**
- Consumes: both databases.
- Produces: `verifyImport(db, legacySql): Promise<VerifyReport>` where

```ts
type VerifyReport = {
  ok: boolean;
  counts: { table: string; legacy: number; imported: number; ok: boolean }[];
  itemDiffs: { itemId: number; field: string; legacy: string | null; imported: string | null }[];
};
```

- [ ] **Step 1: Write the failing test**

`packages/db/src/import/verify-import.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDbClient, type Db } from '../client';
import { createLegacyClient } from './legacy-client';
import { verifyImport, type VerifyReport } from './verify-import';

describe('verifyImport (run after the import tasks)', () => {
  let report: VerifyReport;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const target = createDbClient({ max: 1 });
    const legacy = createLegacyClient();
    close = async () => { await target.sql.end(); await legacy.sql.end(); };
    report = await verifyImport(target.db, legacy.sql);
  }, 120_000);
  afterAll(async () => { await close(); });

  it('reports zero logical differences across all 635 items', () => {
    expect(report.itemDiffs).toEqual([]);
  });

  it('matches every row count', () => {
    for (const c of report.counts) {
      expect(c, `${c.table}: legacy ${c.legacy} vs imported ${c.imported}`).toMatchObject({ ok: true });
    }
  });

  it('passes overall', () => {
    expect(report.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db test -- verify-import.test.ts
```

Expected: FAIL — no `./verify-import`.

- [ ] **Step 3: Implement `verify-import.ts`**

Read each side into the same normalised shape and diff:

```ts
// A comparable rendering of one item's values, keyed by field key. Option values
// render as their `value` string, users as their name — so the comparison is
// meaningful across the id remap.
type ItemState = Map<string, string | null>;
```

- **Legacy side:** for each ticket, join `ticket_values` → `fields` (for `key`), `field_options` (for `value`), `statuses` (for `key`). Multi-value fields render as a **sorted, comma-joined** string.
- **New side:** for each item, join `item_values` → `fields` → `options` (for `value`) and `users` (for `name`). Same rendering.
- **The assignee exception:** legacy renders the option's `value` (`claude-sonnet-5`); the new side renders the user's `name`. They were created with the same string, so they compare equal. That equality is the point of the naming rule in spec §6.2 — if it fails, the agent users were named wrong.
- **Counts:** `projects` 5, `items` 635, `item_values` 2948, `comments` 139, `comment_reactions`, `item_links` 191, `events` 1523 + 635.

`run-verify.ts` prints the report and exits non-zero when `ok` is false.

- [ ] **Step 4: Run the full sequence end to end, from a clean database**

This is the whole plan, executed as one command chain:

```bash
docker exec tickets-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS tickets_dev;"
docker exec tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_dev;"
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db db:migrate
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db db:import
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db db:verify-import
```

Expected: the verifier prints matching counts and `0 differences`, and exits 0.

- [ ] **Step 5: Run every gate in the spec**

```bash
POSTGRES_DATABASE=tickets_dev pnpm --filter @tickets/db test
pnpm --filter @tickets/db typecheck
```

Expected: PASS — model completeness, conformance (both directions), EAV integrity, seed, structure mapping, import, history, verification.

Confirm the live database is **untouched**:

```bash
docker exec tickets-postgres-1 psql -U postgres -d tickets -c "SELECT count(*) FROM tickets;"
```

Expected: `635`, and the app on http://localhost:4610 still works.

- [ ] **Step 6: Rewrite `docs/database.md`**

It currently documents the `ticket*` schema, statuses and type-owned fields — all gone. Rewrite the table as the 22 tables in their four groups, and point it at the model as the SSOT and at the conformance test as the thing that keeps them honest.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/import packages/db/package.json docs/database.md
git commit -m "feat(db): verify the import by diffing logical item state

Not counts — for all 635 items, the set of (field key -> rendered value) must be
identical on both sides, with options rendered by value and users by name.
Zero differences.

docs/database.md rewritten for the 22-table items platform."
```

---

## Definition of done

| Spec gate | Where |
| --- | --- |
| Model completeness | Task 1 |
| Conformance, both directions | Tasks 2–4 |
| One migration, no drift | Task 5 |
| EAV integrity enforced by postgres | Task 6 |
| Seed ≡ import structure | Tasks 7, 9 |
| Import fidelity (logical diff) | Task 12 |
| History: baseline last, kinds mapped, no free text | Task 11 |
| Structure: 15/46/8/114/12/4 | Tasks 9, 10 |
| Assignee upgraded to a user field | Tasks 9, 10, 12 |
| Live `tickets` database untouched | Task 12 Step 5 |

**Not done here, by design:** `apps/api`, `apps/web` and `apps/mcp` do not compile. That is sub-projects 2–4 ([spec roadmap](../specs/2026-07-14-items-platform-schema-and-import-design.md#roadmap--sub-projects-24)).
