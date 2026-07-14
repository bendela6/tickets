import { sql } from 'drizzle-orm';
import {
  boolean, check, integer, jsonb, pgTable, serial, text, timestamp, unique,
} from 'drizzle-orm/pg-core';
import { fieldTypeEnum } from './enums';
import { optionSets } from './option-sets';
import { schemes } from './schemes';

// A scheme-scoped shared definition. Placement (position/required/overrides)
// lives on item_type_fields — definition vs placement.
export const fields = pgTable(
  'fields',
  {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id')
      .notNull()
      .references(() => schemes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    type: fieldTypeEnum('type').notNull(),
    system: boolean('system').notNull().default(false),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    optionSetId: integer('option_set_id').references(() => optionSets.id),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [
    unique('fields_scheme_key').on(t.schemeId, t.key),
    check('fields_option_set_required', sql`type <> 'option' OR option_set_id IS NOT NULL`),
  ],
);
