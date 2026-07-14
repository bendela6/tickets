# Reusable Fields — Design Set

_Make fields **reusable across types** (type ↔ field many-to-many). Test data is disposable, so this is
a **clean target design**, not a migration. One file per layer._

## The change

- **Before:** a field belongs to exactly one type (`fields.ticket_type_id`).
- **After:** a field is a **scheme-scoped shared definition**, **composed** into any number of types
  through a `type_fields` join.

## Principle — definition vs placement

| | Owns | Shared? |
| --- | --- | --- |
| **Definition** — `fields` + `field_options` | key, label, value-type, options, base `config` | one per scheme, reused |
| **Placement** — `type_fields` (join) | `position`, `required`, optional `configOverride` | per (type, field) |
| **Effective field** — `(type, field)` | definition ⊕ placement | what every read/write actually uses |

> A scheme owns a **field library**; each type **composes** a subset of it — like Notion properties
> reused across databases, or Jira custom fields shared across issue types. Items hold values keyed by
> the shared `fieldId`.

## Why

- Define `priority` / `assignee` / `due date` **once**, reuse everywhere.
- **Cross-type reporting is one `fieldId`**, not N per-type copies — filters and rollups get simpler.
- Edit a shared field in one place; per-type tweaks (order, required, workflow) stay local to the type.

## Layers (reading order)

| # | File | Layer |
| --- | --- | --- |
| 1 | [`1-data-model.md`](1-data-model.md) | tables + the *effective field* |
| 2 | [`2-domain.md`](2-domain.md) | vocab load + field resolution |
| 3 | [`3-api.md`](3-api.md) | field library + type composition + item writes |
| 4 | [`4-web.md`](4-web.md) | API client hooks + UI |
| 5 | [`5-events.md`](5-events.md) | config event changes (item stream unaffected) |

## Key decisions

- Fields are **scheme-scoped** (reused within a scheme; not global).
- Per-type differences (`position`, `required`, workflow `transitions`) live in `type_fields` — **override, don't fork**.
- `field_options` are **shared** with the field.
- `ticket_values` is **unchanged** — it already keys on `fieldId`.
- The **item event stream is unchanged**; only config/vocab events change ([5-events](5-events.md)).

## Generic note

This is the generic "reusable attribute" pattern. The entity stays `tickets` here (→ `items` if the
rename lands later); nothing in this design is ticket-specific.
