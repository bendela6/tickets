# Layer 2 — Domain / Vocab

_How fields are loaded and resolved per type. This is the layer everything else reads through —
`load-project-vocab`, `build-value-rows`, transitions, rendering. Get this right and the routes barely
change._

---

## `ProjectVocab` — new shape

The vocab holds the **library** (by field id) and the **placements** (join), and precomputes the
**effective fields** per type:

```ts
type ProjectVocab = {
  scheme: Scheme;
  types: Map<number, TicketType>;                     // by typeId
  fields: Map<number, FieldDef>;                      // the library, by fieldId
  optionsByField: Map<number, FieldOption[]>;         // by fieldId

  // derived — the resolution surface the rest of the app uses:
  effectiveByType: Map<number, EffectiveField[]>;     // typeId → ordered effective fields
  effectiveByTypeKey: Map<string, EffectiveField>;    // `${typeId}:${key}` → effective field
};
```

The old `fieldByTypeKey` becomes `effectiveByTypeKey` — same lookup signature, new source.

---

## `loadProjectVocab`

One scheme's worth of rows, assembled into the maps:

```ts
async function loadProjectVocab(db, projectId): Promise<ProjectVocab> {
  const scheme  = await loadSchemeForProject(db, projectId);
  const types   = await db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, scheme.id));
  const fields  = await db.select().from(fieldsTable).where(eq(fieldsTable.schemeId, scheme.id));
  const options = await db.select().from(fieldOptions).where(inArray(fieldOptions.fieldId, fields.map(f => f.id)));
  const places  = await db.select().from(typeFields).where(inArray(typeFields.ticketTypeId, types.map(t => t.id)));

  const optionsByField = groupBy(options, o => o.fieldId);
  const fieldById = new Map(fields.map(f => [f.id, toFieldDef(f, optionsByField)]));

  const effectiveByType = new Map<number, EffectiveField[]>();
  const effectiveByTypeKey = new Map<string, EffectiveField>();
  for (const p of places) {
    const def = fieldById.get(p.fieldId)!;
    const eff = toEffective(def, p);                  // merge config, attach position/required
    (effectiveByType.get(p.ticketTypeId) ?? set(effectiveByType, p.ticketTypeId, [])).push(eff);
    effectiveByTypeKey.set(`${p.ticketTypeId}:${def.key}`, eff);
  }
  for (const list of effectiveByType.values()) list.sort((a, b) => a.position - b.position);

  return { scheme, types: byId(types), fields: fieldById, optionsByField, effectiveByType, effectiveByTypeKey };
}
```

---

## Resolution helpers

```ts
const fieldsForType   = (v, typeId)      => v.effectiveByType.get(typeId) ?? [];
const fieldByTypeKey  = (v, typeId, key) => v.effectiveByTypeKey.get(`${typeId}:${key}`);
const optionsFor      = (v, fieldId)     => v.optionsByField.get(fieldId) ?? [];

// effective config merge — the one non-obvious bit
function toEffective(def: FieldDef, p: TypeField): EffectiveField {
  return { ...def, position: p.position, required: p.required,
           config: { ...def.config, ...(p.configOverride ?? {}) } };
}
```

---

## Downstream consumers — what changes

| Module | Before | After |
| --- | --- | --- |
| `build-value-rows` | `vocab.fieldByTypeKey.get(\`${typeId}:${key}\`)` | `fieldByTypeKey(vocab, typeId, key)` — resolves through the join; body identical |
| `check-transition` / `resolve-status` | field's own `config.transitions` | **effective** field config (per-type `configOverride` wins) |
| `render-value` | field def + options | unchanged — reads `FieldDef` + `optionsFor` |
| required-field validation | `field.required` | `effective.required` (per-type) |

**Key point:** because the resolution surface (`fieldByTypeKey`, `optionsFor`) keeps its signature and
only its *source* changes, `build-value-rows` and `render-value` are nearly untouched. The real work is
in `loadProjectVocab` + `toEffective`.

---

## Value type resolution (unchanged)

A field's **value type** still comes from `field.type` (the 8-way enum), and `buildValueRows` still maps
it to `ticket_values` columns exactly as today — sharing a field doesn't change how its value is stored.
