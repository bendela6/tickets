import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { fields } from './fields';

// Options for select/multi_select fields. Purely generic — no workflow
// semantics here; those live in the statuses table.
export const fieldOptions = pgTable(
  'field_options',
  {
    id: serial('id').primaryKey(),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    value: text('value').notNull(),
    label: text('label').notNull(),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    position: integer('position').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [unique('field_options_field_value').on(table.fieldId, table.value)],
);
