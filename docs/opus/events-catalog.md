# Event Catalog — all aggregates

_Every event kind across every aggregate, with its payload. Reference companion to
[`1-events.md`](1-events.md) (which owns the envelope + registry). The **ticket** stream is
event-sourced (source of truth at Tier B); **all other streams are audit-only** — their tables stay
authoritative, but every mutation still emits an event._

**Conventions**

- Envelope is identical for all (`aggregateType`, `aggregateId`, `seq`, `kind`, `actorId`, `at`,
  `commandId`, `correlationId`, `causedBy`, `depth`, `projectId`, `version`, `payload`) — see
  [`1-events.md`](1-events.md).
- Payloads are **after-only** and carry **raw ids**, never labels alone.
- `created` → the initial fields · `*.updated` → `{ changed: { … } }` (only what changed) · `archived` / `deleted` → `{}`.
- Every kind is one `defineEvent({ kind, schema, … })` entry in its stream's registry.

---

## Streams

| `aggregateType` | `aggregateId` | Sourced? | Notes |
| --- | --- | --- | --- |
| `ticket` | ticketId | **event-sourced** (Tier B) | the primary stream |
| `scheme` | schemeId | audit | reusable across projects |
| `type` | ticketTypeId | audit | owns fields + child types |
| `field` | fieldId | audit | owns options + config (incl. transitions) |
| `option` | optionId | audit | field option (a workflow status is just an option field) |
| `linkType` | linkTypeId | audit | + allowed target types |
| `project` | projectId | audit | container; `projectId` = self |
| `user` | userId | audit | human / agent |
| `view` | viewId | audit | saved board view |

_(Per-entity `aggregateType`s keep `aggregateId` unambiguous — field 5 and option 5 are different
streams. The core design in [`README.md`](README.md) event-sources only `ticket`; these are the "events
for everything" audit superset.)_

---

## 1. `ticket` — event-sourced

| kind | when | payload |
| --- | --- | --- |
| `ticket.created` | skeleton created | `{ projectId, typeId, number, parentId }` |
| `ticket.reparented` | parent changes | `{ from: number \| null, to: number \| null }` |
| `ticket.archived` | archived | `{}` |
| `ticket.unarchived` | restored | `{}` |
| `field.changed` | any field value | `{ fieldId, type, value }` — see [`1-events.md` §field.changed](1-events.md) |
| `comment.added` | comment posted | `{ commentId, body }` |
| `comment.edited` | body edited | `{ commentId, body }` |
| `comment.deleted` | removed | `{ commentId }` |
| `reaction.added` | reaction added | `{ commentId, emoji }` |
| `reaction.removed` | reaction removed | `{ commentId, emoji }` |
| `link.added` | link created | `{ linkId, linkTypeId, linkTypeKey?, sourceTicketId, targetTicketId }` — both streams |
| `link.removed` | link deleted | `{ linkId }` — both streams |

---

## 2. `scheme` — audit

| kind | when | payload |
| --- | --- | --- |
| `scheme.created` | new scheme | `{ key, name }` |
| `scheme.updated` | renamed / edited | `{ changed: { key?, name? } }` |
| `scheme.archived` | archived | `{}` |
| `scheme.group.set` | schema-group assignment | `{ groupId: number \| null }` |

---

## 3. `type` — audit  (ticket type)

| kind | when | payload |
| --- | --- | --- |
| `type.created` | new type in a scheme | `{ schemeId, key, name, icon? }` |
| `type.updated` | renamed / edited | `{ changed: { key?, name?, icon? } }` |
| `type.archived` | archived | `{}` |
| `type.child_added` | subtype allowed | `{ childTypeId }` |
| `type.child_removed` | subtype disallowed | `{ childTypeId }` |

---

## 4. `field` — audit

| kind | when | payload |
| --- | --- | --- |
| `field.created` | new field on a type | `{ ticketTypeId, key, label, type, required, position, config }` |
| `field.updated` | edited | `{ changed: { label?, required?, config? } }` |
| `field.reordered` | position changed | `{ position }` |
| `field.archived` | archived | `{}` |
| `field.transition_changed` | workflow rules edited (option fields) | `{ transitions }` (mirrors `config.transitions`) |

_(A workflow field's state machine is `config.transitions`; editing it emits `field.transition_changed`.)_

---

## 5. `option` — audit

| kind | when | payload |
| --- | --- | --- |
| `option.added` | new option on a field | `{ fieldId, value, label, color?, position }` |
| `option.updated` | renamed / recolored | `{ changed: { value?, label?, color? } }` |
| `option.reordered` | position changed | `{ position }` |
| `option.archived` | archived | `{}` |

_(A workflow status is an `option` field; each option's lifecycle kind (todo/active/done) rides in `option.config`.)_

---

## 6. `linkType` — audit

| kind | when | payload |
| --- | --- | --- |
| `linkType.created` | new link type | `{ key, name, inwardName, outwardName }` |
| `linkType.updated` | edited | `{ changed: { name?, inwardName?, outwardName? } }` |
| `linkType.archived` | archived | `{}` |
| `linkType.target_added` | allowed target type added | `{ targetTypeId }` |
| `linkType.target_removed` | target removed | `{ targetTypeId }` |

---

## 7. `project` — audit

| kind | when | payload |
| --- | --- | --- |
| `project.created` | new project | `{ key, name, schemeId }` |
| `project.updated` | edited | `{ changed: { name?, schemeId? } }` |
| `project.archived` | archived | `{}` |

---

## 8. `user` — audit

| kind | when | payload |
| --- | --- | --- |
| `user.created` | new user | `{ name, kind }` — `kind: 'human' \| 'agent'` |
| `user.updated` | profile edited | `{ changed: { name? } }` |
| `user.deactivated` | disabled | `{}` |

_(PII: `name` may need crypto-shredding — see [`3-runtime.md` PII](3-runtime.md).)_

---

## 9. `view` — audit

| kind | when | payload |
| --- | --- | --- |
| `view.created` | saved view | `{ ownerId?, projectId?, name, config }` |
| `view.updated` | edited | `{ changed: { name?, config? } }` |
| `view.deleted` | removed | `{}` |

_(`config` references field ids — validate on write; stale on field delete. See open items.)_

---

## Adding to this catalog

Each row is one `defineEvent({ kind, schema, … })` in its stream's registry ([`1-events.md`](1-events.md)).
A new audit event = one file + one `register` line; no schema migration (DB stores `kind text` +
`payload jsonb`). Only `ticket` events need a projector; audit events typically need only a `schema`
(and an optional `activity` mapper if they should show in a feed).

## Scope reminder

**Emitting** events everywhere (this catalog) ≠ **event-sourcing** everywhere. Only `ticket` is rebuilt
from its log. The audit streams give you a full "who changed what, when" trail — and the point-in-time
context to interpret old ticket events — while the vocabulary/config/identity tables stay the source of
truth. Promoting any audit stream to event-sourced later is additive (add projectors), never a rewrite.
