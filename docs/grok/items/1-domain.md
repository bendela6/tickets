# 1 — Domain model

## Core nouns

| Noun | Meaning |
| ---- | ------- |
| **Project** | Workspace: key, name, prefix, scheme binding. Unchanged idea. |
| **Scheme** | Reusable structure pack: types, fields, links, workflow config. |
| **Item type** | Kind of item within a scheme (`task`, `bug`, `subtask`, later `document`, `page`, …). |
| **Item** | One instance: skeleton + EAV values + comments/links/events. |
| **Field** | Typed attribute definition (title, body, status, …). |
| **Value** | An item’s data for one field. |
| **Link** | Edge between two items (blocks, relates, …). |
| **Parent** | Structural hierarchy (`items.parent_id`), not a link type. |

## Item (generic)

An item always has:

- identity (`id`)
- home project (`project_id`)
- type (`type_id` → item type)
- display number within project (`number` → `PREFIX-42`)
- optional parent (`parent_id`, depth policy by type config)
- creator + timestamps + archive flag
- **no** hard-coded title/status columns — those are fields

What makes it a “ticket” vs “document” is **type + field set**, not the table.

```
Project
  └── Items[]          # mixed types allowed in one project
        ├── values[]   # EAV
        ├── comments[]
        ├── links[]    # to other items
        └── events[]   # audit / bus
```

## Type as the behavior switch

| Concern | Driven by |
| ------- | --------- |
| Which fields show | type ↔ fields (ownership model: type-owned **or** M2M attach — orthogonal) |
| Workflow | system `option` field + options + `config.transitions` |
| Allowed children | `item_type_child_types` (e.g. task→subtask; doc→section later) |
| Outgoing link vocabulary | link types owned by source type (or scheme later) |
| UI chrome | type `config` (icon, color, label “Ticket” / “Doc”) |

## Documents (future, same model)

| Approach | Use |
| -------- | --- |
| **Type `document`** with fields `title`, `body` (rich text), … | Default; no new table |
| Optional later `item_blobs` / attachments | Large files, not the item row itself |
| Same comments/links/events | Collaboration on docs = free |

No `documents` table in v1 of this design.

## Vocabulary (code vs product)

| Product copy (optional) | Code / API / DB |
| ----------------------- | --------------- |
| Ticket, Task, Bug | item + type key |
| All tickets | All items (filter by type if needed) |
| Ticket detail | Item detail |
| Board | Board of items |

Prefer **item** in types, routes, and DB. UI strings can stay friendly.

## Invariants

1. Every item belongs to exactly one project.
2. Item’s `type_id` must belong to the project’s scheme.
3. Field values only for fields valid for that type (attach/ownership rules).
4. At most one parent; parent/child allowed only if type graph says so.
5. Links never replace parent/child.
6. Archive is soft (`archived_at`); numbers are not reused (or policy documented).

## Bounded contexts (logical)

| Context | Owns |
| ------- | ---- |
| **Workspace** | projects, users, views |
| **Structure** | schemes, item types, fields, options, link types |
| **Records** | items, values, comments, reactions, links, events |
| **Delivery** | outbox, automations (consumers of item events) |

Same deployable apps; clearer module folders.
