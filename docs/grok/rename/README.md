# Ticket → item rename (current work)

Mechanical rename so the record table is generic **`items`**. Behavior, architecture, and UI patterns **stay as they are**.

## Naming map

### Database

| From | To |
| ---- | -- |
| `tickets` | `items` |
| `ticket_values` | `item_values` |
| `ticket_types` | `item_types` |
| `ticket_type_child_types` | `item_type_child_types` |
| `ticket_links` | `item_links` |
| `ticket_events` | **`events`** — global polymorphic log (`aggregate_type` + `aggregate_id`); not item-only |
| `ticket_id` FKs | `item_id` |
| `ticket_type_id` FKs | `item_type_id` |
| `projects.ticket_prefix` | **`item_prefix`** (locked) |

### Code (apps + packages)

| From | To |
| ---- | -- |
| `tickets` drizzle table | `items` |
| `Ticket` types | `Item` |
| `ticketId` | `itemId` |
| `assembleTickets` | `assembleItems` |
| `nextTicketNumber` | `nextItemNumber` |
| `tickets.routes.ts` | `items.routes.ts` |
| `use-patch-ticket` | `use-patch-item` |
| folders `tickets/` | `items/` |

### HTTP

| From | To |
| ---- | -- |
| `/api/tickets/:id` | `/api/items/:id` |
| `/api/projects/:key/tickets` | `/api/projects/:key/items` |
| JSON `tickets` | `items` |

### Web routes (full words — locked)

| From (today-ish) | To |
| ---------------- | -- |
| ticket detail path | `/p/:projectKey/items/:itemId` |
| create | `/p/:projectKey/items/new` |
| views | `/p/:projectKey/views/:viewId` |

Layout components and Instrument UI **stay**; only path segments and data names change.

### Events (if present / when touched)

| From | To |
| ---- | -- |
| `created` / `value-changed` / … | prefer **`item.created`**, **`item.field_changed`**, … when rewriting kinds |
| aggregate ticket | `item` |

### MCP

| From | To |
| ---- | -- |
| `create_ticket`, `get_ticket`, … | `create_item`, `get_item`, … |
| params `ticketId` | `itemId` |

**Do not maintain MCP as a hand copy forever** — see [mcp-sync.md](mcp-sync.md).

### Packages

**Unchanged:** `@tickets/db`, `@tickets/web`, `@tickets/api`, `@tickets/mcp`.

---

## Layer checklist

### 1. `packages/db`

- [ ] Rename tables/columns in schema modules
- [ ] Update relations, registry, schema-groups labels
- [ ] Fresh migrate or reset dev DB (test data OK to wipe)
- [ ] Seed uses `items` / `item_types`

### 2. `apps/api`

- [ ] Schema imports + queries
- [ ] `items/` domain folder (ex-`tickets/`)
- [ ] Routes path + handler names
- [ ] Comments/links FKs
- [ ] Events writer kinds if renamed
- [ ] Tests

### 3. `apps/web`

- [ ] API client types + hooks
- [ ] Route paths (full words `items`, `views`)
- [ ] Component props/names where they say Ticket
- [ ] Board `items` array

### 4. `apps/mcp`

- [ ] Tool names + params
- [ ] Wire to new HTTP paths
- [ ] Establish **generate/rebuild** path ([mcp-sync.md](mcp-sync.md))

### 5. Docs in-repo

- [ ] `docs/api`, `docs/mcp`, `docs/database.md` — item wording  
- [ ] **Not** `docs/opus/` (leave alone)

---

## Also in this schema pass (locked)

- [ ] Drop `statuses`, `status_transitions`, any `status_id`  
- [ ] System workflow field `type: option` + `field_options` (+ transitions in config)  
- [ ] Scheme-owned `fields` + **`item_type_fields`** M2M (reusable fields)  
- [ ] Table **`events`** global (all aggregate types)  

## What we are *not* doing in this pass

- Command/query registry rewrite  
- New app shells beyond path renames  
- MCP codegen deep design (discuss separately)  
- `@items/*` package rename  
- Touching `docs/opus/`  
- Outbox worker / automations (can follow once events write)

---

## Verify

- [ ] `pnpm typecheck` / tests green  
- [ ] App: create/open item, board, comment, link  
- [ ] MCP tools hit new paths  
- [ ] `rg` for `ticket_values|from tickets|ticket_id` in schema/api = intentional leftovers only  
