# 5 — Database

Greenfield Postgres schema. Drizzle in `packages/db`.

## ER (logical)

```text
users
schemes ──┬── fields ── field_options     # status options live here
          │      └── config.transitions   # workflow graph on the field
          ├── item_types ── item_type_fields (M2M attach)
          │             └── item_type_child_types
          └── link_types ── link_type_target_types

projects ── scheme_id
  ├── views
  └── items ── type_id, parent_id
        ├── item_values     # option_id only; no status_id
        ├── comments ── comment_reactions
        ├── item_links
        └── (events.aggregate_id)

events, commands, outbox, item_activity
```

## Table list

### Identity / workspace

| Table | Purpose |
| ----- | ------- |
| `users` | actors |
| `schemes` | structure packs |
| `projects` | `key`, `name`, `item_prefix`, `scheme_id` |
| `views` | per-project saved lenses; `config` jsonb |

### Structure

| Table | Purpose |
| ----- | ------- |
| `item_types` | types in a scheme |
| `item_type_child_types` | parent/child type pairs |
| `fields` | scheme-owned field defs (incl. system workflow field) |
| `item_type_fields` | M2M: type ↔ field + position + required |
| `field_options` | options for option fields **including status** |
| `link_types` | source-type-owned relation defs |
| `link_type_target_types` | allowed targets |

**Not in schema:** `statuses`, `status_transitions`, `item_values.status_id`.

### Records

| Table | Purpose |
| ----- | ------- |
| `items` | spine: project, type, parent, number, audit cols |
| `item_values` | EAV |
| `comments` | `item_id` |
| `comment_reactions` | |
| `item_links` | source/target item |

### History / delivery

| Table | Purpose |
| ----- | ------- |
| `events` | polymorphic append-only log |
| `commands` | idempotency |
| `outbox` | consumer delivery |
| `item_activity` | feed projection |

## `items` columns

```text
id, project_id, type_id, parent_id, number,
created_by, archived_at, created_at, updated_at
UNIQUE(project_id, number)
```

## `fields` + `item_type_fields`

```text
fields: id, scheme_id, key, label, type, system, config, archived_at, created_at
        UNIQUE(scheme_id, key)

item_type_fields: item_type_id, field_id, position, required
                  PK(item_type_id, field_id)
```

### Workflow field config (example)

System field `key: "status"`, `type: "option"`, `system: true`:

```jsonc
{
  "multiple": false,
  "workflow": true,
  "transitions": [
    { "from": null, "to": 11 },
    { "from": 11, "to": 12 },
    { "from": 12, "to": 13 }
  ]
}
```

```jsonc
// field_options.config for semantic kind (board columns / rollups)
{ "kind": "todo" }    // todo | active | blocked | done | dropped
{ "kind": "done", "color": "green" }
```

If different types need **different** status sets, either attach **different** status fields per type or use one shared field only when options are shared.

## Field types (enum end-state)

`string | number | boolean | date | datetime | option | user | json`  
(+ config for format, multiple, markdown, **transitions**, …)

No `status` field type enum value.

## Indexes (minimum)

- `items(project_id, type_id)`, `items(parent_id)`
- `item_values(item_id)`, filter indexes on (field_id, value_*)
- `events(aggregate_type, aggregate_id, seq)` unique
- `item_activity(item_id, at)`
- `item_links(source)`, `item_links(target)`

## What we do not store

- Title/status as columns on `items`
- **`statuses` / `status_transitions` tables or `status_id` on values**
- Separate `documents` / `tickets` tables
- Parent as only a link row
