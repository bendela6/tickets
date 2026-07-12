# 7 — Monorepo layout, naming map, build order

## Package responsibilities

| Package / app | Role after rename |
| ------------- | ----------------- |
| `packages/db` | Schema: `items`, `item_*`; migrations generated fresh OK |
| `apps/api` | Only DB consumer; item routes + domain |
| `apps/web` | UI; HTTP client; item terminology in code |
| `apps/mcp` | Agent tools over HTTP |
| repo name / npm name | May stay `tickets` product name; **internal** model is items |

Renaming the **GitHub repo or pnpm package** `@tickets/*` is optional and out of scope unless you want a full rebrand (`@items/*`). This design does **not** require it.

## Global rename map

### Database

| From | To |
| ---- | -- |
| `tickets` | `items` |
| `ticket_values` | `item_values` |
| `ticket_links` | `item_links` |
| `ticket_types` | `item_types` |
| `ticket_type_child_types` | `item_type_child_types` |
| `ticket_events` | `events` or `item_events` |
| `*.ticket_id` | `*.item_id` |
| `*.ticket_type_id` | `*.item_type_id` |
| `projects.ticket_prefix` | `projects.item_prefix` (recommended) |

### TypeScript symbols

| From | To |
| ---- | -- |
| `tickets` (drizzle) | `items` |
| `Ticket` | `Item` |
| `assembleTickets` | `assembleItems` |
| `nextTicketNumber` | `nextItemNumber` |
| `usePatchTicket` | `usePatchItem` |
| `ticketId` | `itemId` |
| `typeKey` on ticket | same on item |

### HTTP

| From | To |
| ---- | -- |
| `/api/tickets/:id` | `/api/items/:id` |
| `/api/projects/:key/tickets` | `/api/projects/:key/items` |
| JSON key `tickets` | `items` |

### Events

| From | To |
| ---- | -- |
| `ticket.created` / bare `created` | `item.created` |
| `field.changed` / `value-changed` | `item.field_changed` |
| aggregate `ticket` | `item` |

## Suggested implementation order (greenfield rewrite)

No data migration — order is for **compile/run** stability.

1. **`packages/db`** — new schema names, seed uses `item_types` / `items`, drop old table names.  
2. **`apps/api`** — rename modules + routes; point at new tables; smoke tests.  
3. **`apps/web`** — types, hooks, routes, components.  
4. **`apps/mcp`** — tools + docs.  
5. **Docs** — `docs/api`, `docs/mcp`, `docs/database.md`, design pointers.  
6. **Event platform** (`docs/grok` 1–5) — replace ticket wording with item (follow-up edit).  
7. **Optional product polish** — UI copy, document type in seed.

## Folder target (api domain)

```text
apps/api/src/items/          # domain
apps/api/src/routes/items.routes.ts
packages/db/src/schema/items.ts
packages/db/src/schema/item-values.ts
packages/db/src/schema/item-types.ts
packages/db/src/schema/item-links.ts
packages/db/src/schema/item-type-child-types.ts
```

## Testing strategy

| Layer | Tests |
| ----- | ----- |
| db | schema describe includes `items`, not `tickets` |
| api | pure functions (parent, values) + route integration create/patch item |
| web | smoke render board with `items` |
| mcp | tool schemas use `itemId` |

## Risk notes (even without data migration)

| Risk | Mitigation |
| ---- | ---------- |
| Missed rename in stringly routes | ripgrep `ticket` in apps/packages; fix until intentional UI copy only |
| Event platform docs still say ticket | update `docs/grok/*.md` after this set is accepted |
| Confusion “items” vs list items | use `Item` type name; avoid variable `items` in nested maps without context |
| Document body size | field text/json first; blob table later |

## Relationship to other grok docs

| Doc set | Relationship |
| ------- | -------------- |
| [items/*](.) | **This** — generic record model |
| [../README.md](../README.md) event platform | Same bus; aggregate renamed `item` |
| Field M2M + workflow-as-options | See platform design; no statuses tables |

## Decision summary

| Decision | Choice |
| -------- | ------ |
| Skeleton table | `items` |
| Projects | unchanged concept |
| Documents | item type + fields, not new root table |
| API | `/items`, no ticket paths |
| Events | `item.*` |
| Parent | `items.parent_id` |
| Links | `item_links` |
| Data migration | none (test data discarded) |
