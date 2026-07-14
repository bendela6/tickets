# Layer 4 — Web

_The client shapes, the query/mutation hooks, and the UI. The big new surface is a **field library** +
a **type composer**; the item form barely changes._

---

## API client shapes

```ts
type FieldDef = {
  id: number; schemeId: number; key: string; label: string;
  type: FieldType; system: boolean; config: Record<string, unknown>;
  options?: FieldOption[];
  usedInTypes?: number[];                 // convenience: which types compose it
};

type Placement = { typeId: number; fieldId: number; position: number; required: boolean; configOverride?: object };

type EffectiveField = FieldDef & { position: number; required: boolean; config: Record<string, unknown> };
```

## Hooks

```ts
// library (scheme settings)
useSchemeFields(schemeId): FieldDef[]
useDefineField(schemeId)        // POST /schemes/:id/fields
useUpdateField(fieldId)         // PATCH /fields/:id
useAddOption(fieldId)

// composition (type editor)
useTypeFields(typeId): EffectiveField[]         // ordered, resolved
useAttachField(typeId)          // POST /types/:id/fields   { fieldId, position?, required? }
useDetachField(typeId)          // DELETE /types/:id/fields/:fieldId
useReorderFields(typeId)        // PUT /types/:id/fields/order
useSetPlacement(typeId)         // PATCH /types/:id/fields/:fieldId  { position?, required?, configOverride? }

// item form
useItemFields(ticket): EffectiveField[]         // = useTypeFields(ticket.typeId)
```

`use-vocab-fields` / `use-vocab-workflow` are reshaped to return the **library + placements** instead of
one field list per type.

---

## UI

### 1. Field Library (scheme settings)

The reusable catalog for a scheme.

```
┌ Fields (scheme: Software) ───────────────────────────────┐
│  🔤 Title        string            used in 4 types   ✎    │
│  🔽 Priority     option (3)        used in 4 types   ✎    │
│  👤 Assignee     user              used in 3 types   ✎    │
│  📅 Due date     date              used in 2 types   ✎    │
│  [+ New field]                                            │
└──────────────────────────────────────────────────────────┘
```

- Create / edit a field once; edits propagate to every type that composes it.
- "used in N types" makes reuse visible; editing warns it's shared.
- Options are edited here (shared).

### 2. Type Composer (type editor)

Compose a type from the library; per-type placement lives here.

```
┌ Type: Bug — Fields ──────────────────────────────────────┐
│  ⠿ Title        required ✔        (from library)     ✕   │
│  ⠿ Priority     required ✔                            ✕   │
│  ⠿ Status       required ✔   ⚙ transitions (override) ✕   │
│  ⠿ Assignee     required ✘                            ✕   │
│  [+ Add field ▾]  → pick from library │ create new…       │
└──────────────────────────────────────────────────────────┘
```

- **Add field** → picker: choose an existing library field (attach) or "create new" (define in scheme, then attach).
- **⠿ drag** → reorder (`PUT …/order`).
- **required toggle** → per-type (`PATCH …/:fieldId`).
- **⚙ override** → per-type `configOverride` (e.g. this type's status transitions).
- **✕** → detach (definition stays in the library).

### 3. Item form

Unchanged in spirit — render the item's **effective fields**, ordered by `position`, with required
markers. It already consumed "the type's fields"; now that list comes from the composition.

```tsx
const fields = useItemFields(ticket);           // EffectiveField[]
return fields.map((f) => <FieldInput key={f.id} field={f} value={values[f.key]} required={f.required} />);
```

---

## Flows

| Action | Calls |
| --- | --- |
| Reuse an existing field on a type | Add field → pick from library → `useAttachField` |
| Introduce a brand-new field | Add field → create new → `useDefineField` → `useAttachField` |
| Reorder a type's fields | drag → `useReorderFields` |
| Make a field required on one type only | toggle → `useSetPlacement` |
| Give one type its own workflow | ⚙ override → `useSetPlacement({ configOverride })` |
| Remove a field from a type | ✕ → `useDetachField` (library untouched) |
| Rename a field everywhere | edit in library → `useUpdateField` |
