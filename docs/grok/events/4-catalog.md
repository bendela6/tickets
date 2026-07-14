# Events — full catalog

Reference. Model/registry → [1-model.md](1-model.md).

**Conventions:** envelope shared; payloads value-only / sparse `changed`; ids not labels; each kind = one `defineEvent`.

**Emitting everywhere ≠ event-sourcing everywhere.** Only **item** may become SoT (Tier B). Other streams are **audit**.

## Streams

| aggregateType | aggregateId | Role |
| ------------- | ----------- | ---- |
| `item` | itemId | primary (Tier A/B) |
| `scheme` | schemeId | audit |
| `type` | itemTypeId | audit |
| `field` | fieldId | audit |
| `option` | optionId | audit |
| `linkType` | linkTypeId | audit |
| `project` | projectId | audit |
| `user` | userId | audit |
| `view` | viewId | audit |

---

## `item` (sourced later optional)

| kind | payload |
| ---- | ------- |
| `item.created` | `{ projectId, typeId, number, parentId }` |
| `item.reparented` | `{ from, to }` |
| `item.archived` / `item.unarchived` | `{}` |
| `item.field_changed` | `{ fieldId, type, value }` — [1-model](1-model.md) |
| `item.comment_added` | `{ commentId, body, parentId? }` |
| `item.comment_edited` | `{ commentId, body }` |
| `item.comment_deleted` | `{ commentId }` |
| `item.reaction_added` / `removed` | `{ commentId, emoji }` |
| `item.link_added` | both streams: `{ linkId, linkTypeId, linkTypeKey?, sourceItemId, targetItemId }` |
| `item.link_removed` | both: `{ linkId }` |
| `item.imported` | snapshot for greenfield baseline if needed |

---

## `scheme` (audit)

| kind | payload |
| ---- | ------- |
| `scheme.created` | `{ key, name, description? }` |
| `scheme.updated` | `{ changed: { key?, name?, description?, config? } }` |
| `scheme.archived` | `{}` |

---

## `type` (audit) — item type

| kind | payload |
| ---- | ------- |
| `type.created` | `{ schemeId, key, label, position?, config? }` |
| `type.updated` | `{ changed: { … } }` |
| `type.archived` | `{}` |
| `type.child_added` / `child_removed` | `{ childTypeId }` |
| `type.field_attached` | `{ fieldId, position, required, configOverride? }` |
| `type.field_detached` | `{ fieldId }` |
| `type.field_placement_updated` | `{ fieldId, changed: { position?, required?, configOverride? } }` |

---

## `field` (audit) — library definition

| kind | payload |
| ---- | ------- |
| `field.created` | `{ schemeId, key, label, type, system?, config? }` |
| `field.updated` | `{ changed: { label?, type?, config? } }` |
| `field.archived` | `{}` |

Workflow transitions for a field may live in base `config` or per-type `configOverride` on attach.

---

## `option` (audit)

| kind | payload |
| ---- | ------- |
| `option.added` | `{ fieldId, value, label, position, config? }` |
| `option.updated` | `{ changed: { … } }` |
| `option.reordered` | `{ position }` or batch |
| `option.archived` | `{}` |

`config.kind`: `todo` \| `active` \| `blocked` \| `done` \| `dropped` for board semantics.

---

## `linkType` (audit)

| kind | payload |
| ---- | ------- |
| `linkType.created` | `{ itemTypeId, key, label, inverseLabel, directional, position }` |
| `linkType.updated` | `{ changed: { … } }` |
| `linkType.archived` | `{}` |
| `linkType.target_added` / `removed` | `{ targetTypeId }` |

---

## `project` / `user` / `view` (audit)

| stream | kinds |
| ------ | ----- |
| project | `project.created`, `updated`, `archived` |
| user | `user.created`, `updated`, `archived` |
| view | `view.created`, `updated`, `archived`, `reordered` |

Payloads: identity fields + sparse `changed` as needed.

---

## Scope reminder

Only **item** projectors are required for product SoT path. Audit kinds need schema (+ optional activity). Promoting an audit stream to ES later = add projectors only.
