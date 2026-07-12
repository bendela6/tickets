# Grok design docs — SSOT

Design notes for the tickets monorepo. **Do not edit `docs/opus/` from this workstream** (owner handles that separately).

## Scope: what we are doing now

> **Rename the record spine `ticket*` → `item*` in the database (and matching code identifiers).**  
> **Everything else stays as it is today** — same routes/modules/UI patterns, same processes, no full platform rewrite.

| In scope now | Out of scope now |
| ------------ | ---------------- |
| **All** `ticket*` table/column names → `item*` | Redesigning product flows from scratch |
| Drop **`statuses` / `status_transitions` / `status_id`** — workflow = option field `status` | Command/query registry rewrite (later) |
| **Reusable fields** — scheme library + `item_type_fields` M2M | npm rename to `@items/*` |
| Polymorphic **`events`** log (all aggregates); kinds `item.*` / audit streams | Full UI/IA rewrite |
| `projects.ticket_prefix` → **`item_prefix`** | MCP codegen design (discuss separately) |
| Package scope stays **`@tickets/*`** | Touching `docs/opus/` |

Rename + statuses drop + reusable fields are one coherent schema pass; event **bus consumers** (outbox) can follow immediately after writers exist.

---

## Locked decisions

### Rename & packaging

| Decision | Choice |
| -------- | ------ |
| DB / domain spine | **`items`** — rename **every** `ticket*` table/column to `item*` |
| Global event log | Table **`events`** (not `ticket_events`) — **all** streams (item + config + …) |
| npm packages | **Keep `@tickets/*`** |
| `projects.ticket_prefix` | **`item_prefix`** |
| Parent hierarchy | Keep **`parent_id`** on the item row (not links) |
| Statuses | **Drop tables** — system **option** field (e.g. key `status`) + options + transitions |
| Fields | **Reusable** — scheme-owned library + **M2M** `item_type_fields` (many types ↔ many fields) |
| Implementation style | Existing app structure; schema + renames (not full product rewrite) |
| MCP sync mechanism | **Discuss separately** (must track API eventually) |

### Web URLs (when paths are retargeted)

| Decision | Choice |
| -------- | ------ |
| Path style | **Full words** — e.g. `/p/:projectKey/items/:itemId`, `/p/:projectKey/views/:viewId` (not `/i/`, `/v/`) |

Prefer renaming ticket paths to **items** full words as part of the rename; keep layout/behavior the same.

### MCP ↔ API / events

| Decision | Choice |
| -------- | ------ |
| MCP vs API | **MCP must track API (and event kinds)** — changing API contracts updates MCP without hand-duplicating forever |
| Mechanism | **Generate or rebuild** MCP tools (and docs) from a shared source — e.g. `@tickets/core` command/event descriptors, OpenAPI, or a small codegen script — not a second hand-maintained tool list |

Ideal: one registry of operations (or HTTP route metadata) → API handlers + MCP tool wrappers + docs. Minimum: regenerate MCP tool stubs when API changes (CI check that MCP tools match API surface).

### Events (when event work proceeds)

| Decision | Choice |
| -------- | ------ |
| Kind prefix | **`item.*`** — e.g. `item.field_changed` |
| Field payload | **`value`** only on source events |
| Statuses tables | **None now** — workflow = option field |
| Detach field from type | **Policy A** — block if values exist |
| Reusable fields | **Yes** — M2M both directions (one field → many types; one type → many fields) |

### Explicitly open

| Decision | Status |
| -------- | ------ |
| Per-type **status option subsets** | **Open** — allowlist on join vs separate workflow fields |
| MCP codegen approach | **Open** — discuss separately |
| When to add **outbox consumers** | After item events write reliably (see events phases) |

---

## Doc map

| Path | Role |
| ---- | ---- |
| **[rename/README.md](rename/README.md)** | **Now:** ticket→item rename checklist by layer |
| [platform/](platform/README.md) | Future product/IA direction (not rename scope) |
| [fields/](fields/README.md) | Future reusable fields |
| [events/](events/README.md) | Future event bus (`item.*`) |
| [architecture/](architecture/README.md) | Future command/query registries |
| [items/](items/README.md) | Superseded sketch |

## Stack

pnpm + turbo · Postgres · Drizzle · Fastify · React 19 · TanStack · MCP · Instrument UI · **`@tickets/*` packages**.
