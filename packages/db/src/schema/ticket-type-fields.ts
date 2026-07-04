import { boolean, integer, pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { fields } from './fields';
import { ticketTypes } from './ticket-types';

// Which fields a ticket type shows, in what order, and whether they are
// required there — the field ↔ type dependency.
export const ticketTypeFields = pgTable(
  'ticket_type_fields',
  {
    ticketTypeId: integer('ticket_type_id')
      .notNull()
      .references(() => ticketTypes.id),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    position: integer('position').notNull(),
    required: boolean('required').notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.ticketTypeId, table.fieldId] })],
);
