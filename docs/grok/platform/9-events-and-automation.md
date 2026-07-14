# 9 — Events, activity, automation

**SSOT:** [../events/](../events/README.md). Summary only.

## Principles

- Every record mutation emits **`item.*`** events (locked prefix) in the same transaction.
- Field payload: `{ fieldId, type, value }`.
- Multi-field: N events + `correlationId`.
- Registry: one def file per kind under `events/kinds/`.

## Core kinds

`item.created` · `item.field_changed` · `item.reparented` · `item.archived` · `item.unarchived` ·  
`item.comment_*` · `item.reaction_*` · `item.link_*`

**No `status.changed`.** Workflow = `item.field_changed` + `type: 'option'`.

## Pipeline

```text
Command → validate → state → events + activity + outbox → commit
                              ↓
                         outbox worker → automations / webhooks
```

## Activity

- Table `item_activity` with summary `{ before, after, … }` for UI
- Group by `correlationId` in the item detail activity panel

## Automation (phase after bus works)

- Rules stored as data
- Match on kind + project + field predicates
- Actions call **same command API** as agent (`depth++`, `causedBy`)

## Config audit (optional phase)

`field.created`, `item_type.field_attached`, … on `aggregate_type = 'config'`.
