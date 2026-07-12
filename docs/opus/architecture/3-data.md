# Layer 3 — Data

_The full picture: aggregates and their streams, the event store, the projections (read models), and
the config/identity tables. Table DDL lives in [`../2-schema.md`](../2-schema.md) and
[`../reusable-fields/1-data-model.md`](../reusable-fields/1-data-model.md); this is the **map**._

---

## Three kinds of table

| Kind | Examples | Source of truth |
| --- | --- | --- |
| **Event store** | `events` · `commands` · `outbox` · `item_snapshots` | append-only log |
| **Projections** (read models) | `items` · `item_values` · `item_activity` · board read models | derived — rebuildable from the log (Tier B) |
| **Config / identity** | `schemes` · `types` · `fields` · `type_fields` · `field_options` · `link_types` · `projects` · `users` · `views` | the tables (audited, not sourced) |

The **item** aggregate is event-sourced; everything else is CRUD-with-audit. "Events for everything,
event-sourcing only the item" — see [`../events-catalog.md`](../events-catalog.md).

---

## Aggregates & streams

Every mutation emits an event on its aggregate's stream (`aggregate_type` + `aggregate_id`):

| `aggregateType` | id | Sourced? | Projections it feeds |
| --- | --- | --- | --- |
| `item` | itemId | **event-sourced** | `items`, `item_values`, `item_activity`, boards |
| `field` | fieldId | audit | — (library table authoritative) |
| `option` | optionId | audit | — |
| `type` | typeId | audit | — (incl. `type_fields` composition) |
| `scheme` | schemeId | audit | — |
| `linkType` | linkTypeId | audit | — |
| `project` | projectId | audit | — |
| `user` | userId | audit | — |
| `view` | viewId | audit | — |

---

## The event store

```
events           append-only log; (aggregate_type, aggregate_id, seq) unique; bigserial id = global cursor
commands         idempotency ledger; id = client commandId (PK); cached result for safe retries
outbox           one row per event, same txn; single worker drains in id order → consumers
item_snapshots   (item_id, through_seq) fold checkpoints; Tier B rebuild economy
```

Details + indexes in [`../2-schema.md`](../2-schema.md).

---

## Projections (read models)

Rebuildable by folding the item stream; **inline** in the write txn for strong consistency.

| Table | Shape | Built from |
| --- | --- | --- |
| `items` | skeleton: projectId, typeId, parentId, number, archivedAt | `item.created` / `item.reparented` / `item.archived` |
| `item_values` | EAV: one row per (item, field[, option/user]); hardened (one-value CHECK, partial uniques) | `field.changed` |
| `item_activity` | feed: (itemId, at, actor, before, after, correlationId) | every item event (computes the diff) |
| board / list read models | denormalized per-view rows (optional) | `field.changed` + filters |

Rebuild + diff-against-live is a CI gate ([`../3-runtime.md`](../3-runtime.md)).

---

## Config / vocab (reusable fields)

The shape that makes the item generic — a scheme owns a **field library**, types **compose** it:

```
schemes ──┬── fields (library, scheme-scoped) ──── field_options
          └── types ──┐
                      └── type_fields (join: position, required, configOverride) ── fields
link_types ──── link_type_target_types
```

- `fields` = shared definition · `type_fields` = per-type placement · **effective field** = definition ⊕ placement.
- Full model: [`../reusable-fields/1-data-model.md`](../reusable-fields/1-data-model.md).

---

## Identity / structure

| Table | Role |
| --- | --- |
| `projects` | container; owns item `number` sequence; references a `scheme` |
| `users` | actor; `kind = human \| agent` (agent = automations) |
| `views` | saved board views; `config` jsonb of field ids (validated on write) |
| `items` (`tickets`) | the entity; `parentId` = single-parent tree; `ticket_links` = lateral relations |

---

## Data-flow summary

```
write:  command ── emits ──► events ──(same txn)──► projections + outbox
read:   query ──────────────────────────────────► projections
async:  outbox ── worker ──► automations · webhooks · search
audit:  every config/identity mutation ──► its aggregate stream (no projector)
```

One log, derived read models, audited config — the whole app in four arrows.
