# Items platform — schema rebuild + import — design

Status: approved for planning (brainstormed 2026-07-14)

**Sub-project 1 of 4.** This spec covers the database only: rebuild the schema to
match [`apps/eer/models/items-platform.json`](../../../apps/eer/models/items-platform.json),
collapse the migration history to one migration, and import the live data into it.
The API, the event runtime, the web app and the MCP server are ported in
sub-projects 2–4 ([roadmap](#roadmap--sub-projects-24)).

**Supersedes** `docs/opus/` and `docs/grok/` as the plan of record. Both were written
on 2026-07-12, neither shipped, and they disagree with each other. Where they still
hold, this spec says so and cites them; where the model contradicts them, the model
wins. Their DDL remains the source for the constraint layer, which this spec writes
**into** the model ([§3](#3-the-constraint-layer--enriched-into-the-model)).

---

## Goal

> Replace today's `ticket*` schema with the **items platform** model — 22 tables,
> scheme-scoped reusable fields, no `statuses` tables, and a global append-only
> `events` log — in **one migration**, and bring all 635 live items across with a
> verified, lossless import.

The event *runtime* (command path, registry, outbox, projections) is **not** in this
spec. This spec creates the tables it will need and nothing more.

---

## Locked decisions

| # | Decision | Rationale |
| --- | --- | --- |
| 1 | **The model is the SSOT** — and a *complete* one. `apps/eer/models/items-platform.json` defines entities, columns, types, FKs **and the full constraint layer**: nullability, uniques, checks, indexes, enums ([§3](#3-the-constraint-layer--enriched-into-the-model)). | One artifact, machine-checkable, nothing beside it. |
| 2 | **Enrich the model, then hand-write drizzle to match it**, plus a conformance test that fails on drift. Do *not* block on the round-trip generator. | The model *format* already holds SQL truth (as of `cdb36f1`); only this model *file* is behind. Enriching it is hours; waiting for the generator is 12 more tasks ([coordination](#coordination--the-parallel-round-trip-workstream)). |
| 3 | **Amend the model where it is wrong**, never deviate silently. First amendment: `options.kind` ([§4](#4-model-amendment--optionskind)). | "Code matches the model" must mean *cannot drift* — not *the model is infallible*. |
| 4 | **Delete `packages/db/drizzle/*`; generate exactly one migration.** | Clean slate; no old schema is reachable anyway. |
| 5 | **Build against `tickets_dev`. The live app on `tickets` (:4610) is never touched** until cutover at the end of sub-project 4. | The tracker holds real work across 5 projects. No downtime. |
| 6 | **Import from the backup**, second task, before the app port. | The importer is the sharpest test of the model: if old data has nowhere to go, the model has a hole — find it before building on it. |
| 7 | **Legacy events are carried as `version: 0`, display-only**, behind an `item.imported` baseline placed **last** in each stream. | The 1,523 existing events are lossy (rendered strings, free-text kinds) and can never be replayed. See [§6.3](#63-history--the-lossy-past). |
| 8 | **`assignee` is upgraded to a `user` field during the import.** | The new schema has `user` + `value_user_id` purpose-built for it. Doing it in the importer costs nothing; doing it later means a second pass over every assignee value row. |
| 9 | **Status subsets are an allowlist in `item_type_fields.config_override`.** | Forced by the model — `option_set_id` is on `fields`, so one shared `status` field has exactly one option set. The live data has zero conflicts, so this works cleanly ([§6.2](#62-structure--46-field-defs--15-fields--46-placements)). |
| 10 | **Tier A, not Tier B.** Tables stay the source of truth; events are written alongside. | The model has **no snapshots table** — that is itself the decision. Tier B stays gated on a driver, exactly as both design docs recommended. |

---

## 1. Current state

Nothing from either design has shipped. As of `redesign` @ `ed09701`:

- Schema is `tickets` / `ticket_values` / `ticket_events` / `ticket_types` /
  `ticket_links` / `statuses` / `status_transitions`, with `fields` **type-owned**
  (`fields.ticket_type_id`, `position` + `required` on the definition row).
- `ticket_events` is a lossy free-text audit trail; `kind` is `'created'`,
  `'link-added'`, `'parent-changed'`; payloads carry rendered display strings.
- [`write-event.ts`](../../../apps/api/src/events/write-event.ts) is 12 lines.
  There is no outbox, no commands ledger, no registry, and **nothing consumes** the
  events.
- `ticket_values` has no CHECK and its `unique(ticket_id, field_id, option_id)` is
  defeated by NULL-distinctness — the schema file admits this in its own comment.

**Live data** (`tickets` DB, backed up 2026-07-14 to `backups/`, gitignored):

| projects | items | values | comments | links | events | fields | statuses | types |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 635 | 2,948 | 139 | 191 | 1,523 | 46 | 34 | 5 |

---

## 2. The schema — 22 tables

Verbatim from the model, in its four groups. Names in **bold** are new tables.

| Group | Tables |
| --- | --- |
| **WORKSPACE** | `users` · `projects` (`item_prefix`, `scheme_id`) · `views` |
| **STRUCTURE** | `schemes` · `item_types` · `item_type_child_types` · **`item_type_fields`** · `fields` (scheme-scoped, `option_set_id`) · **`option_sets`** · **`options`** · **`option_transitions`** · `link_types` · `link_type_target_types` |
| **RECORDS** | `items` · `item_values` · `comments` · `comment_reactions` · `item_links` |
| **HISTORY** | **`events`** · **`commands`** · **`outbox`** · **`item_activity`** |

**Dropped:** `tickets`, `ticket_values`, `ticket_events`, `ticket_types`,
`ticket_links`, `ticket_type_child_types`, `statuses`, `status_transitions`,
`field_options`.

**Enums:** `user_kind` (`human` | `agent`) unchanged · `status_kind`
(`todo` | `active` | `blocked` | `done` | `dropped`) **retained** and moved to
`options.kind` ([§4](#4-model-amendment--optionskind)) · `field_type` **rewritten**:

```ts
export const fieldTypeEnum = pgEnum('field_type', [
  'string',    // text / rich_text / url / email — format lives in config
  'number',
  'boolean',
  'date',
  'datetime',
  'option',    // select / multi_select — cardinality in config.multiple
  'user',      // single / multi        — cardinality in config.multiple
  'json',
]);
// removed: 'text', 'select', 'multi_select', 'status'
```

There is **no `status` field type**. A workflow status is an `option` field whose
option set carries lifecycle kinds and whose transitions live in `option_transitions`.

### 2.1 The three-table workflow vocabulary

The model's one genuine improvement over both design docs. `docs/opus/` and
`docs/grok/` both hang options off a field and bury the workflow graph in
`field.config.transitions` jsonb. The model instead gives:

- **`option_sets`** — scheme-scoped, shared. Many option fields can point at one set.
- **`options`** — one choice; carries `kind` ([§4](#4-model-amendment--optionskind)),
  plus `color`/`icon` in `config`.
- **`option_transitions`** — a real table: `field_id`, `from_option_id` (null = valid
  start), `to_option_id`, nullable `item_type_id` (null = all types), `config`.

So `status_transitions` does not disappear — it is **generalised**. The graph stays
queryable and per-type overridable instead of being a jsonb blob nobody can index.

---

## 3. The constraint layer — enriched into the model

**The model file is behind its own format.** `items-platform.json` was written on
2026-07-14 08:03 and is entity/column/FK-level only: every entity has
`"indexes": []`, `constraints` holds nothing but `pk` and `fk`, there is no
nullability, and uniqueness exists **only as English prose** inside column
descriptions (`"(unique)"`, `"(unique/scheme)"`, `"(unique/project)"`). Generating a
migration from it as it stands would produce a schema with no NOT NULLs, no unique
indexes and no integrity checks.

But the **format** can hold all of it, as of `cdb36f1` ([coordination](#coordination--the-parallel-round-trip-workstream)).
[`apps/eer/src/engine/model/types/types.ts`](../../../apps/eer/src/engine/model/types/types.ts)
now defines:

| Model type | Carries |
| --- | --- |
| `Column` | `nullable`, `default`, `identity`, `generated` |
| `Constraint` | `pk` · `unique` (with **`nullsNotDistinct`**) · **`check`** (with `expression`) · `fk` (with `onDelete` / `onUpdate`) |
| `TableIndex` | `columns` (order, nulls, opClass, expressions), `unique`, `method`, **`where`** — a partial-index predicate |
| `Model.enums` | `EnumDecl[]` — name + values |

That is the entire DDL below. **So the constraint layer is not maintained beside the
model — it is written *into* it**, and the model becomes the complete source of truth
the rebuild is checked against. The values themselves come from
[`docs/opus/2-schema.md`](../../opus/2-schema.md) and today's schema; this is where
the correctness lives, and it is now expressible.

**Task 0 of the plan is therefore: enrich `items-platform.json`** — every column's
`nullable`, every unique, every check, every index, plus the three enums — to the DDL
specified in this section. Drizzle is then hand-written to match, and
[§5](#5-conformance--the-model-and-the-code-cannot-drift) asserts the whole of it.

### 3.1 `item_values` — the hardened EAV table

Closes the NULL-distinct duplicate-row hole the current schema documents but does not
fix. This is `docs/opus/`'s P0 and it ships as part of the rebuild.

```ts
export const itemValues = pgTable('item_values', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => items.id),
  fieldId: integer('field_id').notNull().references(() => fields.id),
  valueText: text('value_text'),
  valueNumber: numeric('value_number'),
  valueDate: timestamp('value_date', { withTimezone: true, mode: 'string' }),
  valueBool: boolean('value_bool'),
  valueJson: jsonb('value_json'),
  optionId: integer('option_id').references(() => options.id),
  valueUserId: integer('value_user_id').references(() => users.id),
}, (t) => [
  check('iv_one_value', sql`num_nonnulls(
    value_text, value_number, value_date, value_bool, value_json, option_id, value_user_id) = 1`),
  uniqueIndex('iv_scalar').on(t.itemId, t.fieldId)
    .where(sql`option_id IS NULL AND value_user_id IS NULL`),
  uniqueIndex('iv_option').on(t.itemId, t.fieldId, t.optionId).where(sql`option_id IS NOT NULL`),
  uniqueIndex('iv_user').on(t.itemId, t.fieldId, t.valueUserId).where(sql`value_user_id IS NOT NULL`),
  index('iv_item').on(t.itemId),
  index('iv_field_text').on(t.fieldId, t.valueText),
  index('iv_field_number').on(t.fieldId, t.valueNumber),
  index('iv_field_date').on(t.fieldId, t.valueDate),
  index('iv_field_option').on(t.fieldId, t.optionId),
  index('iv_field_user').on(t.fieldId, t.valueUserId),
]);
```

Exactly one value column populated per row, enforced by postgres. Multi-value
(`option` / `user`) = N rows, each unique, no NULL escape hatch.

### 3.2 `events` — the log

```ts
export const events = pgTable('events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),        // global cursor
  aggregateType: text('aggregate_type').notNull(),             // 'item' | 'field' | 'type' | …
  aggregateId: integer('aggregate_id').notNull(),
  seq: integer('seq').notNull(),                               // per-stream order + concurrency
  kind: text('kind').notNull(),                                // 'item.field_changed'
  version: integer('version').notNull().default(1),            // 0 = imported, lossy
  payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
  actorId: integer('actor_id').notNull().references(() => users.id),
  at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  commandId: uuid('command_id').notNull(),
  correlationId: uuid('correlation_id').notNull(),
  causedBy: bigint('caused_by', { mode: 'number' }).references((): AnyPgColumn => events.id),
  depth: integer('depth').notNull().default(0),
  projectId: integer('project_id'),
}, (t) => [
  unique('events_stream_seq').on(t.aggregateType, t.aggregateId, t.seq),
  index('events_correlation').on(t.correlationId),
  index('events_command').on(t.aggregateType, t.aggregateId, t.commandId),  // NOT unique
  index('events_caused_by').on(t.causedBy),
  index('events_project_at').on(t.projectId, t.at),
  index('events_stream_at').on(t.aggregateType, t.aggregateId, t.at),
]);
```

`unique(aggregate_type, aggregate_id, seq)` is both the stream order and the
optimistic-concurrency backstop. `command_id` is indexed but **not unique** — one
command emits many events; idempotency is the `commands` ledger.

### 3.3 The rest

| Table | Constraints beyond PK/FK |
| --- | --- |
| `users` | `unique(name)`; `kind` = `user_kind` NOT NULL; `email`, `archived_at` nullable |
| `projects` | `unique(key)`; `item_prefix`, `scheme_id` NOT NULL |
| `views` | `project_id` **NOT NULL** — global views (nullable `project_id`) are a Configurable-Views change, out of scope here ([open](#open-questions)) |
| `schemes` | `unique(key)` |
| `item_types` | `unique(scheme_id, key)` |
| `item_type_child_types` | **composite PK** `(parent_type_id, child_type_id)` |
| `item_type_fields` | **composite PK** `(item_type_id, field_id)`; `position` NOT NULL; `required` NOT NULL default `false`; `config_override` nullable; `index(item_type_id, position)` |
| `fields` | `unique(scheme_id, key)`; `check(type <> 'option' OR option_set_id IS NOT NULL)`; `config` NOT NULL default `{}` |
| `option_sets` | `unique(scheme_id, key)` |
| `options` | `unique(option_set_id, value)`; `position` NOT NULL; `kind` nullable ([§4](#4-model-amendment--optionskind)) |
| `option_transitions` | `unique(field_id, from_option_id, to_option_id, item_type_id)` **NULLS NOT DISTINCT**; `to_option_id` NOT NULL |
| `link_types` | `unique(item_type_id, key)`; `directional` NOT NULL |
| `link_type_target_types` | **composite PK** `(link_type_id, target_type_id)` |
| `items` | `unique(project_id, number)`; `index(project_id, type_id)`; `index(parent_id)`; `updated_at` = optimistic-lock token |
| `comments` | `body` NOT NULL; self-FK `parent_id` nullable |
| `comment_reactions` | `unique(comment_id, user_id, emoji)` |
| `item_links` | `unique(link_type_id, source_item_id, target_item_id)`; `check(source_item_id <> target_item_id)`; `index(source_item_id)`; `index(target_item_id)` |
| `commands` | PK is the client-supplied uuid |
| `outbox` | PK `event_id`; **partial index** `WHERE done_at IS NULL` for the worker scan |
| `item_activity` | `unique(event_id)`; `index(item_id, at)`; `index(correlation_id)` |

The three composite PKs are **absent from the model entirely** — it lists only FKs on
those join tables. They are required.

---

## 4. Model amendment — `options.kind`

**The model as written deletes the one workflow semantic the codebase depends on.**
`statuses.kind` is today a `NOT NULL` postgres enum; the model relocates it to
`options.config.kind`, a string inside jsonb, and drops the `status_kind` type.

Sixteen files read it — including the semantic design tokens (there is a colour per
kind), `status-badge`, `kpi-strip`, `child-progress` (the % done rollup),
`use-project-stats`, the board columns, and the MCP `search_tickets` tool.
[`enums.ts`](../../../packages/db/src/schema/enums.ts) calls it *"the only hardcoded
workflow semantic in the system."* In jsonb it would lose DB enforcement (a typo'd
`"dnoe"` inserts fine and silently drops a board column), lose its index, and gain an
absent-value case that a NOT NULL column makes impossible.

The model does not really argue for jsonb — its own description of `options.config`
reads *"kind (todo/active/done), color, icon"*. The line to draw: **`kind` is
queried; `color` and `icon` are only rendered.** Queried values want a column.

**Amendment (the first, and the pattern for any future one):** add to
`items-platform.json` →

```jsonc
// entity "options", new column
{ "name": "kind", "type": "enum", "title": "Kind",
  "description": "Lifecycle semantic for workflow options; null otherwise. (todo | active | blocked | done | dropped)" }
```

`options.kind` is a **nullable** `status_kind` enum — set on workflow options, null on
`priority` / `labels` / `component`. `color` and `icon` stay in `config`. The model
file is edited **in the same commit** as the schema, so the conformance test holds
them in lockstep.

---

## 5. Conformance — the model and the code cannot drift

[`describeSchema()`](../../../packages/db/src/schema/describe-schema.ts) already
returns, per table: `columns[]` with `name` / `type` / `notNull` / `pk` / `fk`, the
`primaryKey`, `uniques[]`, and a `group`. It is extended here to also return
**checks and indexes** (both are on `getTableConfig`), which makes it a complete
description of the drizzle schema.

**The test** (`packages/db/src/schema/model-conformance.test.ts`) loads the enriched
`items-platform.json` and asserts, **in both directions** — a stray table in drizzle
fails just as loudly as a missing one:

1. **Entities** — the table set matches exactly.
2. **Columns** — set, order and `nullable` match, per entity.
3. **Types** — through a normalising map (model `int` → `integer`, `timestamptz` →
   `timestamp with time zone`, `serial`, `bigserial`, `uuid`, `jsonb`, `numeric`,
   `enum` → the pgEnum's name).
4. **Constraints** — every `pk`, `fk` (same columns, same target, same
   `onDelete`/`onUpdate`), `unique` (same columns, same `nullsNotDistinct`) and
   **`check`** (same expression, normalised for whitespace) matches.
5. **Indexes** — name, columns, `unique`, `method`, and the partial `where` predicate.
6. **Enums** — `user_kind`, `status_kind`, `field_type`: names and values.
7. **Groups** — each table's `SCHEMA_GROUPS` key equals the model entity's group
   (resolving the model's sub-groups to their parent).

Because the model is now complete ([§3](#3-the-constraint-layer--enriched-into-the-model)),
this test covers the **whole** schema — there is no hand-maintained layer sitting
outside it. When `describeDrizzle` (round-trip Task 4) lands, it supersedes this test
rather than competing with it: same direction, same guarantee, better plumbing.

---

## 6. The importer

`scripts/import-legacy.ts`. Reads the **old** database (the backup restored into a
scratch DB, `tickets_legacy`) and writes the **new** schema in `tickets_dev`, through
an explicit id map.

**Id policy.** `users`, `projects`, `items`, `comments`, `item_links` **keep their
ids** — TASK-42 stays TASK-42, and nothing outside the DB has to be rewritten.
`fields` and `options` get **new** ids, because they are being restructured; the map
is applied to `item_values.field_id`, `item_values.option_id`, `views.config` (which
references fields by id) and `option_transitions`. Sequences are reset after the
explicit-id inserts.

### 6.1 Mapping

| Old | New |
| --- | --- |
| `users` | `users`, ids preserved |
| `projects.ticket_prefix` | `projects.item_prefix` |
| `ticket_types` | `item_types` |
| `ticket_type_child_types` | `item_type_child_types` |
| 46 type-owned `fields` | **15** scheme-scoped `fields` + **46** `item_type_fields` placements (`position`, `required` move to the placement) |
| `field_options` | **8** `option_sets` / **114** `options`; `fields.option_set_id` → the set ([§6.2](#62-structure--46-field-defs--15-fields--46-placements)) |
| 34 `statuses` | **12** `options` in one shared `status` set, `statuses.kind` → `options.kind`; per-type subsets → `item_type_fields.config_override.allowedOptionIds` |
| `status_transitions` | `option_transitions` (`item_type_id` preserved; `field_id` = the `status` field) |
| `assignee` (select, 347 values) | a **`user`** field; its 4 options become new `users` rows with `kind: 'agent'`; values → `value_user_id` |
| `tickets` | `items` |
| `ticket_values` | `item_values`; `status_id` → `option_id`; `text`→`value_text`, etc. |
| `comments`, `comment_reactions` | unchanged |
| `ticket_links` | `item_links` |
| `link_types` (`ticket_type_id`) | `link_types` (`item_type_id`) |
| `views` | `views`, with `config` field-ids remapped |
| 1,523 `ticket_events` | `events` ([§6.3](#63-history--the-lossy-past)) |

**Field-type map** — the old 8-value enum collapses into the new one. Cardinality and
format, which used to be encoded in the *type*, move into `config`:

| Old `field_type` | New `field_type` | `config` |
| --- | --- | --- |
| `text` | `string` | `{ format: 'markdown' }` on `description`, `findings`, `steps`; none otherwise |
| `number` | `number` | — |
| `date` | `date` | — |
| `boolean` | `boolean` | — |
| `json` | `json` | — |
| `select` | `option` | `{ multiple: false }` |
| `multi_select` | `option` | `{ multiple: true }` |
| `status` | `option` | `{ multiple: false, workflow: true }` — transitions live in `option_transitions`, not here |
| *(`assignee`, by decision)* | `user` | `{ multiple: false }` |

### 6.2 Structure — 46 field defs → 15 fields + 46 placements

The live data was checked before this design was written, and it is **conflict-free**:

- All **15 distinct field keys** have exactly one `type` and exactly one option set
  across every item type. `title` is always `text`; `priority` is always the same 5
  options. So the collapse is mechanical, with nothing to disambiguate.
- The **34 statuses reduce to 12 distinct keys**, and each key has exactly one
  lifecycle kind everywhere (`blocked`→blocked, `fixed`→done, `wont-fix`→dropped).
  So one shared `status` option set works, and each type's subset is an allowlist.

This answers the question `docs/grok/` left explicitly open ("per-type status option
subsets — allowlist vs separate fields"): **allowlist**, in `config_override`.

The importer must **fail loudly, not guess**, if either invariant is violated at
import time (a key with two types, or a status key with two kinds).

**Expected output, exactly** — the importer asserts these:

| | Count |
| --- | --- |
| `fields` | **15** — `title` `description` `status` `priority` `assignee` `labels` `component` `target_date` `estimate` `pr` `environment` `findings` `kind` `severity` `steps` |
| `item_type_fields` | **46** |
| `option_sets` | **8** — `status` (12) · `component` (79) · `kind` (6) · `priority` (5) · `severity` (5) · `estimate` (4) · `environment` (3) · `labels` (**0**) |
| `options` | **114** |
| new `users` | **4** (`kind: 'agent'`) |

Two edge cases fall out of the real data and must be handled, not discovered later:

- **`labels` is a `multi_select` with zero options and zero values.** It still becomes
  an `option` field (`config.multiple: true`), so the
  `check(type <> 'option' OR option_set_id IS NOT NULL)` in [§3.3](#33-the-rest)
  forces it to point at an **empty option set**. That is legal and intended — an empty
  vocabulary, not a missing one.
- **`assignee` has 4 options but only one is ever used** (all 347 values are
  `claude-sonnet-5`). The importer creates all **4** as `users` rows with
  `kind: 'agent'`, named exactly as the option values, and leaves the 3 existing users
  (`claude`, `Beka`, `migration`) untouched — it does **not** try to reconcile
  `claude-sonnet-5` with the existing `claude`, because that guess is not recoverable
  if it is wrong.

Seven of the 15 fields (`pr`, `steps`, `findings`, `target_date`, `labels`,
`environment`, `severity`) hold **no values at all**. They are vocabulary, and they
import as such.

### 6.3 History — the lossy past

The 1,523 `ticket_events` carry free-text kinds and rendered display strings. Nothing
can make them retroactively replayable. They are imported as **history you can read
but not fold**:

- `aggregate_type: 'item'`, `aggregate_id` = the item id, `seq` = `ROW_NUMBER()` over
  `(ticket_id ORDER BY created_at, id)`, kinds mapped (`created`→`item.created`,
  `link-added`→`item.link_added`, `parent-changed`→`item.reparented`, …), payload
  carried as-is, `version: 0`, a fresh uuid for `command_id` = `correlation_id`,
  `caused_by: null`, `depth: 0`, `project_id` denormalised from the item.
- Then **one `item.imported` event per item, appended last** (`seq = n + 1`,
  `version: 1`), carrying the item's full value snapshot at import time.

**The baseline goes at the end of the stream, not at `seq = 1`.** Both design docs put
it first — which would have quietly broken replay, because folding forward from a
`seq = 1` baseline runs straight through the lossy `version: 0` rows. The rule is:
**a rebuild starts at the newest `item.imported`.** Everything before it is display-only.

`version: 0` is the marker for "lossy, do not fold", and it exists nowhere else.

**The importer writes `events` only.** `outbox`, `commands` and `item_activity` are
created by the migration and left **empty**:

- **`outbox`** — an outbox row means *deliver this to consumers*. Imported history must
  never fire an automation or a webhook. Enqueueing 1,523 historical events would, the
  moment the sub-project 3 worker starts, replay years of activity at whatever rules
  exist. It stays empty.
- **`commands`** — the ledger records *accepted commands*. Imported events did not come
  through the command path; their `command_id` is a synthetic uuid with no ledger row,
  and nothing references it (the model puts no FK on `events.command_id`).
- **`item_activity`** — the feed projection is designed and backfilled in sub-project 3,
  from the log. Building it here would mean writing the projector twice.

---

## 7. Seed

`packages/db/src/seed.ts` is rewritten to build a scheme from nothing: item types,
the field library, option sets (including `status` with its lifecycle kinds), option
transitions, and link types. It must produce a scheme structurally identical to what
the importer produces from the live data — that equivalence is what lets sub-projects
2–4 develop against seeded data and still cut over cleanly.

---

## 8. Verification — measured, not asserted

Per the project's standing rule, every gate is a measurement.

| Gate | Check |
| --- | --- |
| **Model completeness** | `items-platform.json` carries a `nullable` on every column, the three enums, and every unique / check / index in [§3](#3-the-constraint-layer--enriched-into-the-model). A model with `"indexes": []` on `item_values` fails. |
| **Conformance** | `describeSchema()` vs the model: entities, columns, types, **nullability, constraints, checks, indexes, enums**, groups — both directions. A renamed column or a dropped check fails the build ([§5](#5-conformance--the-model-and-the-code-cannot-drift)). |
| **One migration** | `packages/db/drizzle/` contains exactly one `.sql` file; applying it to an empty database reproduces the schema; `drizzle-kit generate` afterwards produces **no diff**. |
| **EAV integrity** | Inserting an `item_values` row with 0 or 2 populated value columns is **rejected by postgres**, not by the app. Same for a duplicate scalar row. |
| **Import fidelity** | `scripts/verify-import.ts` reads both databases and compares **logical state per item**: for all 635 items, the set of (field key → value) must be identical. Counts must match exactly: 5 / 635 / 2,948 / 139 / 191. Any diff fails. |
| **History** | Every item has exactly one `item.imported` event, and it is the highest `seq` in its stream. Every `version: 0` event has a mapped kind (no free text survives). |
| **Structure** | 15 fields · 46 placements · 8 option sets · 114 options · 12 status options · 4 new agent users. Every type's allowlist is a subset of the status option set; every `option` field has an `option_set_id`. |
| **Assignee upgrade** | `assignee` is a `user` field; 347 values live in `value_user_id`, zero in `option_id`; no `item_values` row anywhere still points at a `field_options` descendant of the old assignee set. |

---

## Roadmap — sub-projects 2–4

Each gets its own spec → plan → implementation. The live app stays on the `tickets`
database throughout; the cutover is the last act of sub-project 4.

| # | Sub-project | Exit |
| --- | --- | --- |
| **2** | **API** — command path, event registry (`defineEvent` + valibot per kind), `events` + `commands` written in-txn, routes on `/api/items`, no statuses, reusable fields | `pnpm typecheck` + api tests green against `tickets_dev`; every mutation writes a typed lossless event; a retried `commandId` is a no-op |
| **3** | **Bus** — `outbox` worker (`FOR UPDATE SKIP LOCKED`), `item_activity` projection, first automation consumer (the [2026-07-07 automation spec](2026-07-07-automation-event-bus-and-rules-design.md), which has been waiting on exactly this) | feed renders per-field diffs; a real rule fires after a process restart; outbox lag p99 < 2s |
| **4** | **Web + MCP + cutover** — board/tiles/rollups off `options.kind`, settings UI, item routes, MCP tools renamed, then re-import from a fresh dump and flip `tickets` | the app works on :4610 against the new schema |

**Tier B** (the event log becomes the source of truth) stays gated on a concrete
driver, as both design docs recommended. The model has no snapshots table; adding one
is the first move if that driver ever appears.

---

## Coordination — the parallel round-trip workstream

A second workstream is executing
[`2026-07-14-eer-drizzle-roundtrip`](../plans/2026-07-14-eer-drizzle-roundtrip.md)
(15 tasks) **concurrently**. As of this spec it has landed:

| | Commit | Task |
| --- | --- | --- |
| 13:07 | `27d4dce` | 1 — type catalogue derived from drizzle's builder registry |
| 13:35 | `cdb36f1` | 2 — **the model holds SQL truth**: nullability, checks, uniques with `nullsNotDistinct`, indexes with `method`/`where`, identity, generated, enums |
| 13:51 | `6748671` | 3 — edits preserve what the editor cannot author |

**Task 2 is why this spec's §3 and §5 read as they do.** It closed the gap that would
otherwise have forced a hand-maintained constraint layer beside the model. Task 4
(`describeDrizzle`) is next, and it supersedes the conformance test in
[§5](#5-conformance--the-model-and-the-code-cannot-drift).

**File boundary, to avoid collision:**

| Owner | Files |
| --- | --- |
| **Round-trip workstream** | `apps/eer/src/**` — the model *format*, the editor, the emitter |
| **This spec** | `packages/db/**`, `scripts/**`, and `apps/eer/models/items-platform.json` — the model *content* |

The one shared artifact is `items-platform.json`. This spec **enriches its content**;
the round-trip stream **evolves its schema**. If the format changes under us, the
enrichment is re-serialised through `load-model` → `serialize-model`, not re-typed by
hand.

---

## Open questions

| Question | Status |
| --- | --- |
| `views.project_id` nullable (global cross-project views) | **Deferred.** Wanted by [Configurable Views E7](../plans/2026-07-08-configurable-views-db-changes.md), out of scope here. It is a one-line `DROP NOT NULL` whenever that initiative resumes. |
| `events.aggregate_type` vocabulary — which config streams actually emit | **Sub-project 2.** The table accepts any string; the tables are created here, the kinds are designed there. |
| Event kind catalogue | **Sub-project 2**, except the mapped legacy kinds this spec pins in [§6.3](#63-history--the-lossy-past). |
| MCP tool renames (`create_ticket` → `create_item`) | **Sub-project 4.** Breaks agent-facing tool names; needs its own call. |

---

## Types

- **`SchemaGraph`** = `{ tables: TableMeta[]; groups: GroupMeta[] }` — returned by
  `describeSchema()`.
- **`TableMeta`** = `{ name: string; group: string; columns: ColumnMeta[]; primaryKey: string[]; uniques: UniqueMeta[] }`.
- **`ColumnMeta`** = `{ name: string; type: string; notNull: boolean; pk: boolean; fk: { table: string; column: string } | null }`.
- **`UniqueMeta`** = `{ name: string; columns: string[] }`.
- **`GroupMeta`** = `{ key: string; label: string; color: string; tables: string[] }`.
The model's own types, from
[`apps/eer/src/engine/model/types/types.ts`](../../../apps/eer/src/engine/model/types/types.ts)
— these are what the enriched `items-platform.json` serialises to, and what the
conformance test reads:

- **`Entity`** = `{ id: string; label: string; group: string; description: string | null; schema: string | null; columns: Column[]; constraints: Constraint[]; indexes: TableIndex[]; x: number; y: number }`.
- **`Column`** = `{ name: string; type: string; title: string | null; description: string | null; nullable: boolean; default: string | null; identity: Identity | null; generated: Generated | null }`.
- **`Constraint`** = a discriminated union on `kind`:
  `{ kind: 'pk'; name; columns }` ·
  `{ kind: 'unique'; name; columns; nullsNotDistinct: boolean }` ·
  `{ kind: 'check'; name; expression: string }` ·
  `{ kind: 'fk'; name; columns; refSchema; refTable; refColumns; onDelete: FkAction | null; onUpdate: FkAction | null }`
  — each also carrying an `id: string`.
- **`FkAction`** = `'cascade' | 'restrict' | 'set null' | 'set default' | 'no action'`.
- **`TableIndex`** = `{ id: string; name: string; columns: IndexColumn[]; unique: boolean; method: string | null; only: boolean; where: string | null }` — `where` is the partial-index predicate.
- **`IndexColumn`** = `{ expression: string; isExpression: boolean; order: 'asc' | 'desc' | null; nulls: 'first' | 'last' | null; opClass: string | null }`.
- **`EnumDecl`** = `{ name: string; values: string[]; schema: string | null }`.
- **`Identity`** = `{ always: boolean; name: string | null; increment: string | null; minValue: string | null; maxValue: string | null; startWith: string | null; cache: string | null; cycle: boolean | null }`.
- **`Generated`** = `{ expression: string; stored: true }`.
- **`Group`** = `{ id: string; label: string; order: number; parent: string | null }` — one level of nesting only.
- **`FieldType`** = `'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'option' | 'user' | 'json'`.
- **`StatusKind`** = `'todo' | 'active' | 'blocked' | 'done' | 'dropped'` — the
  `status_kind` pgEnum, on `options.kind`, nullable.
- **`UserKind`** = `'human' | 'agent'`.
