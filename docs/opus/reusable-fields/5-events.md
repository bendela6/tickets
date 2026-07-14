# Layer 5 — Events

_How the change touches the event model. **The item stream is unaffected** — `field.changed` still keys
on `fieldId`. Only the config/vocab streams change: the field **library** and the type **composition**
become distinct, separately-audited concerns. Ties into
[`../events-catalog.md`](../events-catalog.md)._

---

## Item stream — unchanged

```jsonc
// field.changed still references the shared fieldId — sharing changes config, not per-item events
{ "fieldId": 3, "type": "option", "value": [88] }
```

A field being shared across types has **zero** effect on how an item's value change is recorded.

---

## Field library stream (`aggregateType = 'field'`)

The shared definition + its options.

| kind | payload |
| --- | --- |
| `field.created` | `{ schemeId, key, label, type, config }` |
| `field.updated` | `{ changed: { label?, config? } }` |
| `field.archived` | `{}` |
| `option.added` | `{ value, label, color?, config? }` |
| `option.updated` | `{ changed: { label?, color?, config? } }` |
| `option.archived` | `{}` |

_(Note: `field.created` carries **`schemeId`**, not `ticketTypeId` — a library field isn't born on a
type.)_

---

## Type composition stream (`aggregateType = 'type'`)

The join — attaching/detaching/ordering fields on a type. This is the new audit surface the m2m model
introduces.

| kind | payload |
| --- | --- |
| `type.field_attached` | `{ fieldId, position, required }` |
| `type.field_detached` | `{ fieldId }` |
| `type.field_reordered` | `{ order: number[] }` |
| `type.field_placement_changed` | `{ fieldId, changed: { position?, required?, configOverride? } }` |

Together, "what a type looks like" is now reconstructable from **two** streams: the library
(`field.*` / `option.*`) and the composition (`type.field_*`).

---

## Registry entries

Each is one self-registering `defineEvent` on the relevant stream ([`../1-events.md` registry](../1-events.md)):

```ts
// events/kinds/type-field-attached.ts
export const typeFieldAttachedEvent = defineEvent({
  kind: 'type.field_attached',
  schema: v.object({ fieldId: v.number(), position: v.number(), required: v.boolean() }),
  // audit-only: no projector (the type_fields table stays authoritative)
});
```

Config streams are **audit-only** — no projector; the `fields` / `type_fields` / `field_options` tables
remain the source of truth. Add an `activity` mapper only if these should surface in a feed.

---

## Why two streams (not one `config`)

Per-entity `aggregateType`s keep `aggregateId` unambiguous and let each concern be queried on its own:
"history of the `Priority` field" (field stream, one id) vs "how the `Bug` type's fields changed over
time" (type stream, one id). Lumping both under a single `config` stream would force payload scans to
separate them.
