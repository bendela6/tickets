# Application Architecture — clean rethink

_A from-scratch architecture that unifies everything: an **event-sourced item aggregate**, a
**registry-driven** command/query/event model, **reusable fields**, and **CQRS-lite** read models — on
the existing Fastify + Postgres + Drizzle stack. Data is disposable, so this is the **target design**,
not a migration._

## The one big idea

> **Everything is a registry of self-contained definitions, and routing/dispatch is generic.**
> A command, a query, an event kind — each is one `define*({ name/kind, schema, handler })` file.
> Adding a feature = add one (or a few) definition files; nothing central to wire.

This single pattern gives the whole app the "one file per action" property you asked for — at the
command, query, **and** event layers.

## Principles

- **CQRS-lite** — the **write side** validates commands and emits **events**; the **read side** serves from **projections** (read models). Same DB, two paths.
- **Event-source the item aggregate** — the log is the source of truth for an item's state (Tier B); everything else (config, identity) is CRUD-with-audit.
- **Generic entity** — `item` (the renamed `ticket`) shaped entirely by schemes → types → **reusable fields**. Nothing hard-codes "ticket".
- **One bus** — a single transactional **outbox** drives projections, automations, and webhooks.
- **Vertical slices** — a feature lives in a few colocated files (command + event + projector), not smeared across layers.
- **Thin edges, pure core** — HTTP and DB are adapters; validation/domain logic is pure and testable.

## Layers

```
            HTTP (Fastify)            ── routing is a thin dispatch to registries
                 │
   ┌─────────────┴─────────────┐
   ▼ write                     ▼ read
 COMMANDS registry          QUERIES registry
 (validate → emit events)   (read projections)
   │                           ▲
   ▼                           │
 DOMAIN  (aggregates · event registry · vocab/effective-field · transitions · invariants)  ── pure
   │                           │
   ▼                           │
 INFRA (event store · outbox · projectors · snapshots · Drizzle)  ─────┘
   │
   ▼
 CONSUMERS (outbox worker → automations · webhooks · search)
```

## A feature, end to end

Patch an item's field:

1. `PATCH /api/items/:id` → route dispatches the **`item.patch`** command (by name).
2. Command handler: idempotency (commands ledger) → load vocab + state → validate (field ∈ type via the reusable-fields join, transitions, required) → build **`field.changed`** events.
3. Event store appends the events; the **`field.changed`** registry def's `project` folds `item_values`, its `activity` writes `item_activity`; an **outbox** row is written — all one transaction.
4. Response returns new state + etag. The **outbox worker** later feeds automations/webhooks.

Every arrow is generic dispatch reading a registry; the only feature-specific code is the command def
and the event def.

## Reading order

| # | File | Covers |
| --- | --- | --- |
| 1 | [`1-file-structure.md`](1-file-structure.md) | monorepo + `apps/api` module layout; where each thing lives |
| 2 | [`2-pipeline.md`](2-pipeline.md) | routing, the command/query registries, the write & read pipelines |
| 3 | [`3-data.md`](3-data.md) | the full DB map — aggregates, streams, event store, projections, config, identity |

## Builds on

- **Event model + registry** — [`../1-events.md`](../1-events.md), [`../2-schema.md`](../2-schema.md), [`../3-runtime.md`](../3-runtime.md), [`../events-catalog.md`](../events-catalog.md)
- **Reusable fields** — [`../reusable-fields/`](../reusable-fields/README.md)
- **Rollout** — [`../4-migration-plan.md`](../4-migration-plan.md)

This doc set is the **integration view**; those own the details.
