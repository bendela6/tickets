# 11 — Build plan (vertical slices)

**Greenfield** on `redesign`. No legacy data migration.

## Slice 0 — Skeleton

- [ ] Repo folders + **`packages/core`** scaffold
- [ ] `packages/db`: projects, users, schemes, item_types, fields, item_type_fields, items, item_values
- [ ] Seed: scheme, task+document types, shared fields attached, project, sample items
- [ ] API: command/query registry shell + `board.list` / health
- [ ] Web: home + project + view shell + item table
- [ ] Routing per [4-information-architecture.md](4-information-architecture.md)

**Exit:** open app, see project, see items with title field.

---

## Slice 1 — Item CRUD

- [ ] `POST/PATCH/GET` items
- [ ] assemble values; optimistic lock
- [ ] item detail route + create flow
- [ ] parent check + children list
- [ ] MCP: create/get/update item

**Exit:** full J3/J4 in UI and MCP.

---

## Slice 2 — Collaboration

- [ ] comments + reactions
- [ ] item links + link types in structure
- [ ] UI panels on item detail

**Exit:** J5/J6.

---

## Slice 3 — Views & board

- [ ] views table + CRUD
- [ ] table + simple board layouts
- [ ] filters/sort from view config
- [ ] default view redirect

**Exit:** J2 feels like a product.

---

## Slice 4 — Structure settings

- [ ] fields + item_type_fields attach API/UI
- [ ] options, types, link types settings
- [ ] workflow as system `option` field + `config.transitions` + option `config.kind` (no statuses tables)

**Exit:** J8 without code deploy for new fields.

---

## Slice 5 — Events & activity

- [ ] per [../events/5-phases.md](../events/5-phases.md) E0–E2
- [ ] all kinds `item.*` including `item.field_changed`
- [ ] item activity panel + MCP `list_item_events`

**Exit:** history on every mutation; outbox + one consumer.

---

## Slice 6 — Outbox & automation foundation

- [ ] outbox + worker
- [ ] one automation rule path
- [ ] metrics/lag

**Exit:** J10 thin version.

---

## Slice 7 — Polish

- [ ] cross-project all items
- [ ] schema ERD page updated for new tables
- [ ] document type seed + body editor
- [ ] design-system pass on shells
- [ ] docs/api + docs/mcp complete

---

## Parallelism

| Track A | Track B |
| ------- | ------- |
| db + api records | web shell + routing |
| structure API | settings UI |
| events | activity UI |

After Slice 0, A/B can parallelize on contracts agreed in platform docs.

## Definition of done (platform rethink)

- No `tickets` table or `/tickets` API
- Item types include at least task-like + document-like
- Routes match IA
- Features folder structure in web; context folders in api
- Events registered for item mutations
- MCP parity on core item ops
