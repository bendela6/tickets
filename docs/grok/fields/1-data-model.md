# Fields — data model

```
scheme ── fields (library) ── field_options
       └── item_types ── item_type_fields (join) ── fields
items (typeId) ── item_values (fieldId)
```

## Tables

```ts
// fields — SHARED definition
fields: {
  id, schemeId, key, label, type, // string|number|boolean|date|datetime|option|user|json
  system, config, archivedAt, createdAt
}
// UNIQUE (scheme_id, key)

// item_type_fields — placement
item_type_fields: {
  itemTypeId, fieldId,           // PK
  position, required,
  configOverride,                // jsonb | null — e.g. transitions per type
}

// field_options — shared with field
field_options: {
  id, fieldId, value, label, position, config, archivedAt
}
// config.kind for workflow options: todo|active|blocked|done|dropped
```

## Effective field

```ts
type EffectiveField = FieldDef & {
  position: number;
  required: boolean;
  config: MergedConfig; // field.config ← overlay configOverride
};
```

Resolution: load type’s join rows → merge config → validate writes against effective field.

## Workflow

System field `key: 'status'`, `type: 'option'`, often `system: true`:

- Options in `field_options`
- Transitions in `field.config.transitions` **or** `item_type_fields.configOverride.transitions` if types differ
- Value: `item_values.option_id` only

## Values

`item_values` unchanged in shape except **no `status_id`**; harden with one-value CHECK + partial uniques (see events schema).
