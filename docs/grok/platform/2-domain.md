# 2 — Domain model

## Bounded contexts

| Context | Responsibility | Main entities |
| ------- | -------------- | ------------- |
| **Identity** | Who acts | `users` (human \| agent) |
| **Workspace** | Where work lives | `projects`, `views` |
| **Structure** | Shape of work | `schemes`, `item_types`, `fields`, `field_options`, `link_types` (workflow = option field + config) |
| **Records** | Instances | `items`, `item_values`, `comments`, `comment_reactions`, `item_links` |
| **History** | Facts over time | `events`, `commands`, `outbox`, `item_activity` |
| **Automation** | Reactions | rules, runs (later tables) |

## Entity dictionary

| Entity | Definition |
| ------ | ---------- |
| **User** | Actor; human or agent. |
| **Scheme** | Reusable blueprint: types + fields + links + default views. |
| **Project** | Concrete workspace bound to one scheme; owns items and views. |
| **Item type** | Class of item (`task`, `bug`, `document`, …). Config: label, icon, product copy. |
| **Item** | Instance in a project: number, type, parent, archive, timestamps. |
| **Field** | Attribute definition (type, key, config). |
| **Item value** | EAV cell for one item + field. |
| **Link type** | Named relation vocabulary (blocks, relates, …). |
| **Item link** | Edge between two items. |
| **Comment / reaction** | Discussion on an item. |
| **View** | Saved lens: columns, filters, sort, layout mode. |
| **Event** | Immutable fact about an aggregate (primarily `item`). |

## Hierarchy vs links

| Mechanism | Use |
| --------- | --- |
| `items.parent_id` | Tree (epic→task→subtask, doc→section if desired) |
| `item_links` | Graph (blocks, duplicates, relates) |

Never encode primary parent only as a link.

## Field ownership (target)

Prefer **reusable fields** for a real rethink:

```
scheme
  fields + field_options
item_types
  item_type_fields (type_id, field_id, position, required)
```

Type-owned fields (current) remain a possible interim; **target** is M2M attach so “Priority” is one field used by many types.

## Documents

- Type key e.g. `document`
- Fields: `title`, `body` (rich text), optional workflow `status` **option field**, `owner`, …
- Same comments, links, events, views
- Large binaries later: `attachments` table keyed by `item_id` (not required day one)

## Workflow (no separate statuses)

There is **no** `statuses` / `status_transitions` table.

| Concern | Model |
| ------- | ----- |
| Status options | `field_options` on a system **`option`** field (key e.g. `status`) |
| Semantic buckets (todo/active/done/…) | `field_options.config.kind` (or equivalent) for board columns / rollups |
| Allowed transitions | `fields.config.transitions` — edges between option ids (and optional null start) |
| Current status | `item_values` row with `option_id` for that field |
| Change status | `item.field_changed` with `type: 'option'`, `value: [optionId]` |

Write path: `checkTransition(field, fromOptionId, toOptionId)` against `config.transitions` before emit.

## Invariants

1. Item.project.scheme owns item.type.
2. Values only for fields attached to the item’s type.
3. Parent allowed only if `(parent.type, child.type)` in child-type graph.
4. Single parent; no self-parent.
5. Link endpoints in same project (v1) unless later “cross-project links” is designed.
6. Soft archive on items and structure rows.
7. Optimistic concurrency on item updates (`updated_at` or stream `seq`).
8. No first-class status entity — only options + field config.

## Ubiquitous language

Use in code and API:

`Item`, `ItemType`, `ItemValue`, `ItemLink`, `Project`, `Scheme`, `Field`, `View`, `Event`, `Actor`

Avoid: `Ticket` as a type name (OK as UI string for a type label).
