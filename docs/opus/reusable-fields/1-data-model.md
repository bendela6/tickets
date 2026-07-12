# Layer 1 — Data model

_The tables and the **effective field** they combine into. Drizzle; target-state._

---

## Shape

```
scheme ──┬── fields (library)      ──── field_options
         └── ticket_types ──┐
                            └── type_fields (join) ── fields
tickets (typeId) ──── ticket_values (fieldId)
```

- A **scheme** owns a field **library** and a set of **types**.
- A **type** composes fields from the library via `type_fields`.
- An **item** (`tickets`) has a type and holds `ticket_values` keyed by the shared `fieldId`.

---

## Tables

```ts
// fields — the SHARED definition (one row per scheme, reused across types)
export const fields = pgTable('fields', {
  id: serial('id').primaryKey(),
  schemeId: integer('scheme_id').notNull().references(() => schemes.id),
  key: text('key').notNull(),
  label: text('label').notNull(),
  type: fieldTypeEnum('type').notNull(),                       // string · number · boolean · date · datetime · option · user · json
  system: boolean('system').notNull().default(false),
  config: jsonb('config').notNull().default(sql`'{}'::jsonb`), // base config: format, option settings
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [unique('fields_scheme_key').on(t.schemeId, t.key)]);

// type_fields — the JOIN: a field's placement in a type
export const typeFields = pgTable('type_fields', {
  ticketTypeId: integer('ticket_type_id').notNull().references(() => ticketTypes.id),
  fieldId: integer('field_id').notNull().references(() => fields.id),
  position: integer('position').notNull(),
  required: boolean('required').notNull().default(false),
  configOverride: jsonb('config_override'),                   // per-type override (e.g. transitions); null = use field.config
}, (t) => [
  primaryKey({ columns: [t.ticketTypeId, t.fieldId] }),
  index('type_fields_type_position').on(t.ticketTypeId, t.position),
]);

// field_options — shared with the field
export const fieldOptions = pgTable('field_options', {
  id: serial('id').primaryKey(),
  fieldId: integer('field_id').notNull().references(() => fields.id),
  value: text('value').notNull(),
  label: text('label').notNull(),
  color: text('color'),
  position: integer('position').notNull(),
  config: jsonb('config').notNull().default(sql`'{}'::jsonb`),  // e.g. status_kind for workflow options
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
}, (t) => [unique('field_options_field_value').on(t.fieldId, t.value)]);

// ticket_values — UNCHANGED; already keys on fieldId
export const ticketValues = pgTable('ticket_values', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id),
  fieldId: integer('field_id').notNull().references(() => fields.id),
  valueText: text('value_text'),
  valueNumber: numeric('value_number'),
  valueDate: timestamp('value_date', { withTimezone: true, mode: 'string' }),
  valueBool: boolean('value_bool'),
  valueJson: jsonb('value_json'),
  optionId: integer('option_id').references(() => fieldOptions.id),
  valueUserId: integer('value_user_id').references(() => users.id),
}, (t) => [
  check('tv_one_value', sql`num_nonnulls(value_text, value_number, value_date, value_bool, value_json, option_id, value_user_id) = 1`),
  uniqueIndex('tv_scalar').on(t.ticketId, t.fieldId).where(sql`option_id IS NULL AND value_user_id IS NULL`),
  uniqueIndex('tv_option').on(t.ticketId, t.fieldId, t.optionId).where(sql`option_id IS NOT NULL`),
  uniqueIndex('tv_user').on(t.ticketId, t.fieldId, t.valueUserId).where(sql`value_user_id IS NOT NULL`),
  index('tv_ticket').on(t.ticketId),
  index('tv_field_option').on(t.fieldId, t.optionId),
]);
```

`tickets` and `ticket_types` are unchanged except `ticket_types` no longer *owns* fields.

---

## The effective field

Reads and writes never use the raw `fields` row alone — they use the **effective field** for a given
type (definition ⊕ placement):

```ts
type FieldDef = {
  id: number; schemeId: number; key: string; label: string;
  type: FieldType; system: boolean; config: Record<string, unknown>;
  options?: FieldOption[];                       // for option fields
};

type EffectiveField = FieldDef & {
  position: number;                              // from type_fields
  required: boolean;                             // from type_fields
  config: Record<string, unknown>;               // field.config ⊕ type_fields.configOverride
};
```

`config` is a shallow merge: `{ ...field.config, ...typeField.configOverride }` — so workflow
`transitions` (or any per-type tweak) override the base without forking the field.

---

## Invariants

| Invariant | Enforced by |
| --- | --- |
| A key names one field per scheme | `unique(scheme_id, key)` |
| A field is placed once per type | `primaryKey(ticket_type_id, field_id)` |
| An option belongs to its field | `field_options.field_id` FK |
| A value belongs to one (item, field) | `ticket_values` partial uniques |
| A type's fields ⊆ its scheme's library | app-level (field.schemeId == type.schemeId) |

---

## What's shared vs per-type

| Attribute | Where | Shared across types? |
| --- | --- | --- |
| key, label, value-type | `fields` | ✅ shared |
| options (values/labels/colors) | `field_options` | ✅ shared |
| base `config` (format, …) | `fields.config` | ✅ shared |
| `position` | `type_fields` | ❌ per-type |
| `required` | `type_fields` | ❌ per-type |
| workflow `transitions` / tweaks | `type_fields.configOverride` | ❌ per-type |
