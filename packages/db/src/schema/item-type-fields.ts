import { boolean, index, integer, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { fields } from './fields';
import { itemTypes } from './item-types';
import { structureSchema } from './schemas';

// Placement: which fields a type shows, in what order, required or not.
// config_override carries per-type tweaks — e.g. allowedOptionIds, the status
// subset for this type.
export const itemTypeFields = structureSchema.table(
  'item_type_fields',
  {
    itemTypeId: integer('item_type_id')
      .notNull()
      .references(() => itemTypes.id),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    position: integer('position').notNull(),
    required: boolean('required').notNull().default(false),
    configOverride: jsonb('config_override'),
  },
  (t) => [
    primaryKey({ columns: [t.itemTypeId, t.fieldId] }),
    index('itf_type_position').on(t.itemTypeId, t.position),
  ],
);
