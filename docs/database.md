# Database tables

Postgres, managed by drizzle. Schema sources live in
[`packages/db/src/schema/`](../packages/db/src/schema/). Only `apps/api`
touches the database — the web app and MCP server go through the HTTP API.

This is a **generic items platform**: there is no `tickets` table and no
type-owned fields. A `scheme` bundles a set of `item_types`, a shared `fields`
library, and `option_sets` — every item type in the scheme draws from the same
field/option vocabulary instead of owning its own copy. A workflow "status" is
not a special column; it is an `option` field like any other, whose option set
happens to carry `kind` values and whose legal moves are recorded in
`option_transitions`.

**Source of truth**: [`apps/eer/models/items-platform.json`](../apps/eer/models/items-platform.json)
is the ER model — every entity, column, type, nullability, key, and index is
defined there first. `packages/db/src/schema/*.ts` is drizzle's
implementation of that model, and
[`model-conformance.test.ts`](../packages/db/src/schema/model-conformance.test.ts)
asserts the two never drift: columns, types/nullability, primary keys,
foreign keys, uniques, checks, indexes, enums, and each table's group
assignment are all checked in **both directions** (a stray table in drizzle
fails as loudly as a missing one). This doc is a map for orientation; the
model and that test are the actual spec.

The schema is organised into four groups
([`schema-groups.ts`](../packages/db/src/schema/schema-groups.ts)), 22 tables
total.

## Workspace (3 tables)

| Table | Purpose | Key constraints |
| ----- | ------- | --------------- |
| `users` | Actors for mutations and comments — humans and agents | `name` unique; `kind` is [`user_kind`](#user_kind) |
| `projects` | Workspace container bound to one structure scheme | `key` unique |
| `views` | Saved board/table lens scoped to a project; `config` holds `{ columns, sort, filters }` | — |

## Structure (10 tables)

| Table | Purpose | Key constraints |
| ----- | ------- | --------------- |
| `schemes` | Structure-pack root: one scheme bundles a full set of types, fields and option sets | `key` unique |
| `item_types` | Kinds of items within a scheme (task, bug, document, …) | unique `(scheme_id, key)` |
| `item_type_child_types` | Which child types may hang under a parent type — hierarchy rules (e.g. epic → task) | PK `(parent_type_id, child_type_id)` |
| `item_type_fields` | **Placement**: which fields a type shows, in what order, required or not; `config_override` carries per-type tweaks (e.g. an allowed-options subset). Definition stays on `fields` | PK `(item_type_id, field_id)` |
| `fields` | Scheme-scoped, shared field library (reusable across types) | unique `(scheme_id, key)`; `type` is [`field_type`](#field_type); check `type <> 'option' OR option_set_id IS NOT NULL` |
| `option_sets` | A shared, named list of options; many option/user-typed fields can reuse one set | unique `(scheme_id, key)` |
| `options` | One choice in an option set (e.g. a status value, a priority level) | unique `(option_set_id, value)`; `kind` is [`status_kind`](#status_kind), set only on workflow (status) options |
| `option_transitions` | The workflow graph: which option may move to which, on a workflow field. `from_option_id NULL` = a valid starting option; `item_type_id NULL` = applies to every type using the field | unique `(field_id, from_option_id, to_option_id, item_type_id)` nulls-not-distinct |
| `link_types` | Named relation vocabulary owned by a source item type (seeded: `blocks`, `relates-to`, `duplicates`) | unique `(item_type_id, key)` |
| `link_type_target_types` | Which item types may be targets of a given link type | PK `(link_type_id, target_type_id)` |

## Records (5 tables)

| Table | Purpose | Key constraints |
| ----- | ------- | --------------- |
| `items` | Record spine — id, project, type, parent, timestamps. Everything user-visible lives in `item_values`. `updated_at` doubles as the optimistic-lock token | unique `(project_id, number)` |
| `item_values` | EAV value rows: one row per scalar value, N rows for a multi-value field. Exactly one of the value columns is populated per row | check `iv_one_value`: `num_nonnulls(value_text, value_number, value_date, value_bool, value_json, option_id, value_user_id) = 1`; partial uniques `iv_scalar (item_id, field_id)` where option/user are null, `iv_option (item_id, field_id, option_id)`, `iv_user (item_id, field_id, value_user_id)` |
| `comments` | Discussion threads on an item (markdown body); `parent_id` self-references `comments.id` for replies | — |
| `comment_reactions` | Emoji reactions on comments | unique `(comment_id, user_id, emoji)` |
| `item_links` | Typed edges between two items, "source *label* target". Parent/child is **not** a link — that is `items.parent_id` | unique `(link_type_id, source_item_id, target_item_id)`; check `source_item_id <> target_item_id` |

## History (4 tables)

| Table | Purpose | Key constraints |
| ----- | ------- | --------------- |
| `events` | Global append-only log, one stream per `(aggregate_type, aggregate_id)`. `version 0` = an imported legacy row — lossy, display-only, never folded; `version 1+` = a real domain event a rebuild folds forward from the newest baseline | unique `events_stream_seq (aggregate_type, aggregate_id, seq)` — stream order and the optimistic-concurrency backstop |
| `commands` | Idempotency ledger: one row per accepted command; a retried `command_id` collides on the PK and is a no-op | PK `id` (the command's own uuid) |
| `outbox` | Reliable after-commit handoff to consumers — one row per event, drained in id order by a single worker (sub-project 3). Empty until then | PK `event_id` (1:1 with `events`) |
| `item_activity` | Per-item activity feed projection (UI diffs), folded from `events` (sub-project 3). Empty until then | unique `(event_id)` |

## Notes

- **EAV integrity is enforced by postgres, not the app.** `item_values`'s
  `iv_one_value` CHECK and its three partial unique indexes are the final
  word on "exactly one value column populated" and "no duplicate value for
  a scalar/option/user field" — see
  [`item-values-integrity.test.ts`](../packages/db/src/schema/item-values-integrity.test.ts).
- **A workflow status is an option value, not a column.** `item_values` has
  no `status_id`; a status lives in `item_values.option_id` pointing at an
  `options` row whose `kind` is set. `option_transitions` is the workflow
  graph for *any* option field, not just status.
- **Assignee is a `user`-typed field**, not an option field: its value lives
  in `item_values.value_user_id`, resolving to a `users` row (so an assignee
  renders by name, not by a stored option string).
- **One migration, no drift**: the whole schema is a single drizzle
  migration (`packages/db/drizzle/`) generated from the tables above; there
  is nothing hand-edited between the model, the migration, and the live
  schema.
- **Structure counts** (software scheme, current import): 15 fields,
  46 field placements (`item_type_fields`), 8 option sets, 114 options,
  9 link types, 5 item types.
- **Legacy import**: the real production data (5 projects, 635 items, 2,948
  values, 139 comments, 191 links, 2,158 events) was migrated from the
  pre-rebuild `ticket*` schema by
  [`packages/db/src/import/`](../packages/db/src/import/).
  [`verify-import.ts`](../packages/db/src/import/verify-import.ts) diffs the
  **logical state** of every item (not just row counts) between the old and
  new schema and is run via `pnpm --filter @tickets/db db:verify-import`.

## Types

- <a id="user_kind"></a>**`user_kind`** (enum): `human · agent`.
- <a id="status_kind"></a>**`status_kind`** (enum): `todo · active · blocked · done · dropped` — the only workflow semantic code knows (used for board tiles, progress rollups, filter buckets).
- <a id="field_type"></a>**`field_type`** (enum): `string · number · boolean · date · datetime · option · user · json`. Format (url/email/markdown) and cardinality (single/multiple) ride in `fields.config`, not in the type.
