import { sql } from 'drizzle-orm';
import {
  boolean, check, index, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { fields } from './fields';
import { items } from './items';
import { options } from './options';
import { users } from './users';

// Exactly one value column is populated per row — enforced by the DB, not the
// app. Multi-value (option/user) = N rows. No status_id: a workflow status is
// an option value like any other.
export const itemValues = pgTable(
  'item_values',
  {
    id: serial('id').primaryKey(),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    valueText: text('value_text'),
    valueNumber: numeric('value_number'),
    valueDate: timestamp('value_date', { withTimezone: true, mode: 'string' }),
    valueBool: boolean('value_bool'),
    valueJson: jsonb('value_json'),
    optionId: integer('option_id').references(() => options.id),
    valueUserId: integer('value_user_id').references(() => users.id),
  },
  (t) => [
    check(
      'iv_one_value',
      sql`num_nonnulls(value_text, value_number, value_date, value_bool, value_json, option_id, value_user_id) = 1`,
    ),
    uniqueIndex('iv_scalar')
      .on(t.itemId, t.fieldId)
      .where(sql`option_id IS NULL AND value_user_id IS NULL`),
    uniqueIndex('iv_option')
      .on(t.itemId, t.fieldId, t.optionId)
      .where(sql`option_id IS NOT NULL`),
    uniqueIndex('iv_user')
      .on(t.itemId, t.fieldId, t.valueUserId)
      .where(sql`value_user_id IS NOT NULL`),
    index('iv_item').on(t.itemId),
    index('iv_field_text').on(t.fieldId, t.valueText),
    index('iv_field_number').on(t.fieldId, t.valueNumber),
    index('iv_field_date').on(t.fieldId, t.valueDate),
    index('iv_field_option').on(t.fieldId, t.optionId),
    index('iv_field_user').on(t.fieldId, t.valueUserId),
  ],
);
