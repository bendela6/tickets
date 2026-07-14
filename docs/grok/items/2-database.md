# 2 — Database layer

Package: `packages/db`. Clean slate — table names below are the target.

## Naming map (old → new)

| Old | New |
| --- | --- |
| `tickets` | **`items`** |
| `ticket_values` | **`item_values`** |
| `ticket_events` | **`events`** (or `item_events` if you keep ticket-only log) |
| `ticket_links` | **`item_links`** |
| `ticket_types` | **`item_types`** |
| `ticket_type_child_types` | **`item_type_child_types`** |
| `comments.ticket_id` | **`comments.item_id`** |
| `comment_reactions` | unchanged (still on comments) |
| `projects`, `users`, `schemes`, `views`, `fields`, … | unchanged names (FK targets update) |

Drizzle exports: `items`, `itemValues`, `itemTypes`, `itemLinks`, … (camelCase).

## ER overview

```
schemes
  ├── item_types
  │     ├── item_type_child_types
  │     ├── fields              # if type-owned; or scheme-owned + item_type_fields M2M
  │     ├── field_options
  │     └── link_types → link_type_target_types
  │           (workflow: fields.config.transitions + field_options; no statuses tables)
  │
projects → scheme_id
  ├── items → project_id, type_id, parent_id
  │     ├── item_values
  │     ├── comments → item_id
  │     ├── item_links (source/target item_id)
  │     └── events (aggregate_type='item', aggregate_id=item_id)
  └── views
users
```

## Tables

### `item_types` (was `ticket_types`)

```text
id, scheme_id, key, label, position, config, archived_at, created_at
UNIQUE (scheme_id, key)
```

`config` examples: `{ "icon": "doc", "productLabel": "Document" }`.

### `item_type_child_types`

```text
parent_type_id → item_types
child_type_id  → item_types
PK (parent_type_id, child_type_id)
```

### `items` (was `tickets`)

```text
id              serial PK
project_id      → projects  NOT NULL
type_id         → item_types NOT NULL
parent_id       → items NULL
number          int NOT NULL          -- display number in project
created_by      → users NOT NULL
archived_at     timestamptz NULL
created_at      timestamptz NOT NULL
updated_at      timestamptz NOT NULL  -- optimistic lock token

UNIQUE (project_id, number)
INDEX (project_id, type_id)
INDEX (parent_id)
```

### `item_values` (was `ticket_values`)

```text
id, item_id → items, field_id → fields
value_text, value_number, value_date, value_bool, value_json
option_id, value_user_id?   # no status_id
-- same EAV rules as today (harden when ready)
INDEX (item_id), …
```

### `item_links` (was `ticket_links`)

```text
id, link_type_id, source_item_id → items, target_item_id → items
UNIQUE (link_type_id, source_item_id, target_item_id)
CHECK (source_item_id <> target_item_id)
```

### `comments`

```text
id, item_id → items, author_id → users, parent_id → comments, body, created_at
```

### `events` (generic log; see events design)

```text
aggregate_type  -- 'item' | 'config' | …
aggregate_id    -- item id when aggregate_type = 'item'
…
project_id
```

If you prefer a thin name: `item_events` with `item_id` only — fine for item-only log; polymorphic `events` matches the event-platform plan.

### Structure tables (names stable, FKs retarget)

- `fields` — still reference `item_types` **or** scheme + junction (orthogonal decision)
- `link_types.ticket_type_id` → rename column to **`item_type_id`**

## Indexes & constraints (same intent as today)

- Project number uniqueness
- EAV uniques / checks when you harden values
- Link no-self
- No DB-enforced “type ∈ project scheme” (app invariant) unless you add a composite trigger later

## Seed

- Scheme seeds `item_types` keys: `task`, `bug`, `subtask`, optionally `document`
- Document type: fields `title` (string), `body` (string/markdown), maybe `status`
- No seed rows required for real tickets — empty projects OK

## `packages/db` surface

```ts
// packages/db/src/schema/items.ts
export const items = pgTable('items', { … });

// index.ts exports
export { items, itemValues, itemTypes, itemLinks, itemTypeChildTypes, … }
```

Schema groups (ERD page): rename group label **Ticket data → Records / Items**.

## Studio / raw SQL

All references use `items`, `item_values`, etc. Drop any leftover `tickets` synonyms (clean slate).
