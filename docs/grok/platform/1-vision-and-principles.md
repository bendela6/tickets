# 1 — Vision and principles

## Vision

A **project workspace** where people and agents manage structured work and knowledge as **items**:

- work items (task, bug, subtask, …)
- knowledge items (document, note, …) — same spine, different type/fields
- relationships (links, parent/child)
- history and automations (events + bus)

One product surface: **browse → open item → edit → activity**, with boards/views as lenses.

## Principles

1. **One record spine** — `items` table; specialization via **type + fields**, not parallel roots.
2. **Projects are the tenancy boundary** — all records live in a project; scheme defines shape.
3. **Structure is data** — types, fields, options, link types, views are rows, not code deploys.
4. **Commands and queries split in process** — write path validates + records facts; reads use assembled DTOs / projections.
5. **Lossless events** — mutations emit typed `item.*` (and later config) events with `value` payloads.
6. **UI is a client of the API** — no direct DB from web/MCP.
7. **Names match the model** — code, routes, tables say `item`; marketing copy may say ticket/doc.
8. **Greenfield allowed** — prefer correct names and modules over compatibility shims.
9. **Extensible without migrations for product shape** — new item types and fields = data; new *value shapes* = deliberate code.
10. **Agent-first class** — MCP tools mirror human capabilities on the same API.
11. **No parallel status system** — workflow is an `option` field + options + transitions in `config`, not `statuses` tables.
12. **Event kinds are `item.*`** — e.g. `item.field_changed` (not bare `field.changed`).
13. **Greenfield rewrite** on `redesign`; command/query registries; `@tickets/core` shared contracts.

## Non-goals (v1 of rethink)

- Multi-workspace / org hierarchy above projects
- Real auth/SSO (actor picker stays acceptable)
- Full CRDT collaborative doc editing
- Event-sourcing every config table as SoT
- Mobile native apps
- Keeping `/tickets` URLs or table names

## Success metrics

| Metric | Target |
| ------ | ------ |
| Add item type “document” | seed/config only, no new table |
| Add field to a type | API/UI, no deploy for schema columns |
| Navigate project → view → item → back | stable deep links |
| Agent creates/updates item | MCP = same invariants as UI |
| New event kind | one `register(def)` + emit site |
