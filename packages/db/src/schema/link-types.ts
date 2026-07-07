import { boolean, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { ticketTypes } from './ticket-types';

// Data-driven relation vocabulary: blocks / relates-to / duplicates / …
export const linkTypes = pgTable(
  'link_types',
  {
    id: serial('id').primaryKey(),
    ticketTypeId: integer('ticket_type_id')
      .notNull()
      .references(() => ticketTypes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    inverseLabel: text('inverse_label').notNull(),
    directional: boolean('directional').notNull(),
    position: integer('position').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [unique('link_types_ticket_type_key').on(table.ticketTypeId, table.key)],
);
