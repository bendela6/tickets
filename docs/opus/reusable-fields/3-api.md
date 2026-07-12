# Layer 3 — API

_Two management surfaces (library + composition) and the item write path. Endpoint *shapes* for item
writes are unchanged; the field/type management endpoints are the real new surface._

---

## A. Field library — scheme-scoped (definition)

Manage the shared definitions. These **never** touch types.

| Method | Path | Body | Emits |
| --- | --- | --- | --- |
| POST | `/api/schemes/:schemeId/fields` | `{ key, label, type, config? }` | `field.created` |
| PATCH | `/api/fields/:fieldId` | `{ label?, config?, archived? }` | `field.updated` / `field.archived` |
| POST | `/api/fields/:fieldId/options` | `{ value, label, color?, config? }` | `option.added` |
| PATCH | `/api/field-options/:optionId` | `{ label?, color?, archived? }` | `option.updated` / `option.archived` |

```ts
// define a field in a scheme's library
async function defineField(tx, schemeId, body) {
  assertUniqueKey(tx, schemeId, body.key);
  return tx.insert(fields).values({ schemeId, ...body }).returning();
  // NOT attached to any type yet — composition is a separate step
}
```

---

## B. Type composition — the join (placement)

Compose the library into a type. This is where `many-to-many` lives.

| Method | Path | Body | Emits |
| --- | --- | --- | --- |
| POST | `/api/types/:typeId/fields` | `{ fieldId, position?, required? }` | `type.field_attached` |
| PATCH | `/api/types/:typeId/fields/:fieldId` | `{ position?, required?, configOverride? }` | `type.field_placement_changed` |
| DELETE | `/api/types/:typeId/fields/:fieldId` | — | `type.field_detached` |
| PUT | `/api/types/:typeId/fields/order` | `{ order: number[] }` (fieldIds) | `type.field_reordered` |

```ts
// attach an existing library field to a type
async function attachField(tx, typeId, { fieldId, position, required = false }) {
  assertSameScheme(tx, typeId, fieldId);                 // field.schemeId === type.schemeId
  const pos = position ?? (await nextPosition(tx, typeId));
  return tx.insert(typeFields).values({ ticketTypeId: typeId, fieldId, position: pos, required });
}

// detach — the definition survives; only the placement is removed
async function detachField(tx, typeId, fieldId) {
  assertNotSystem(tx, fieldId);
  await tx.delete(typeFields).where(and(eq(typeFields.ticketTypeId, typeId), eq(typeFields.fieldId, fieldId)));
  // existing ticket_values for that (type's items, field) become orphaned reads → hide, or GC by a job
}
```

**Detach note:** items may already have values for a detached field. Options: (a) leave the rows and
just stop showing the field on the type, or (b) a background GC removes values whose field is no longer
placed on the item's type. Recommend (a) — non-destructive, and re-attaching restores them.

---

## Item write path — nearly unchanged

`create` / `patch` ticket endpoints keep their request/response shapes. Only resolution + validation go
through the join:

```ts
// PATCH /api/tickets/:id  (inside the command txn)
for (const [key, raw] of Object.entries(body.values)) {
  const field = fieldByTypeKey(vocab, ticket.typeId, key);      // ← join-resolved effective field
  if (!field) throw new HttpError(400, `field "${key}" not on this type`);
  const rows = buildValueRows(vocab, key, raw, ticket.typeId);  // body identical to today
  // transitions use field.config (effective — per-type override already merged)
  // …replace rows, emit field.changed …
}

// on create: enforce required
for (const f of fieldsForType(vocab, typeId)) {
  if (f.required && !(f.key in body.values)) throw new HttpError(400, `"${f.key}" is required`);
}
```

---

## Validation rules

| Rule | Check |
| --- | --- |
| field belongs to the item's type | `fieldByTypeKey(vocab, typeId, key)` exists |
| option belongs to the field | `optionsFor(vocab, fieldId)` contains it |
| required satisfied (create) | every `effective.required` field present |
| attach within scheme | `field.schemeId === type.schemeId` |
| single placement | PK on `(typeId, fieldId)` |
| legal transition | `checkTransition` over **effective** config |

---

## MCP

- `get_ticket` — returns the item's values plus its **effective fields** (resolved per type); shape unchanged for consumers.
- schema/vocab tools — expose the **library** (scheme fields) and each type's **composition** (placements) as two distinct lists instead of one field list per type.
- `create_ticket` — unchanged; validates values against the type's effective fields.
