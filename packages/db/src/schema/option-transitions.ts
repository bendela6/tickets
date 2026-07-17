import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, unique } from 'drizzle-orm/pg-core';
import { fields } from './fields';
import { itemTypes } from './item-types';
import { options } from './options';

// The workflow graph. from_option_id NULL = a valid starting option;
// item_type_id NULL = applies to every type using the field.
export const optionTransitions = pgTable(
  'option_transitions',
  {
    id: serial('id').primaryKey(),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    fromOptionId: integer('from_option_id').references(() => options.id),
    toOptionId: integer('to_option_id')
      .notNull()
      .references(() => options.id),
    itemTypeId: integer('item_type_id').references(() => itemTypes.id),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    unique('option_transitions_edge')
      .on(t.fieldId, t.fromOptionId, t.toOptionId, t.itemTypeId)
      .nullsNotDistinct(),
  ],
);
