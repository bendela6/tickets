import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { fieldOptions } from './field-options';
import { fields } from './fields';
import { statuses } from './statuses';
import { tickets } from './tickets';

// One row per value; the populated column depends on the field's type.
// multi_select fields hold N rows (one per option). Single-SELECT uniqueness is
// app-level (write path replaces in one transaction) — the partial index below
// can't see option-carrying rows.
export const ticketValues = pgTable(
  'ticket_values',
  {
    id: serial('id').primaryKey(),
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => tickets.id),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    valueText: text('value_text'),
    valueNumber: numeric('value_number'),
    valueDate: timestamp('value_date', { withTimezone: true, mode: 'string' }),
    valueBool: boolean('value_bool'),
    valueJson: jsonb('value_json'),
    optionId: integer('option_id').references(() => fieldOptions.id),
    statusId: integer('status_id').references(() => statuses.id),
  },
  (table) => [
    unique('ticket_values_ticket_field_option').on(table.ticketId, table.fieldId, table.optionId),
    // DB-enforced single row for text/number/date/bool/json/status values
    uniqueIndex('ticket_values_single')
      .on(table.ticketId, table.fieldId)
      .where(sql`option_id IS NULL`),
    index('ticket_values_ticket').on(table.ticketId),
    index('ticket_values_field_option').on(table.fieldId, table.optionId),
    index('ticket_values_status').on(table.statusId),
    index('ticket_values_field_text').on(table.fieldId, table.valueText),
  ],
);
