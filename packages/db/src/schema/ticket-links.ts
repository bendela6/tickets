import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, serial, timestamp, unique } from 'drizzle-orm/pg-core';
import { linkTypes } from './link-types';
import { tickets } from './tickets';

// Generic ticket ↔ ticket relations; reads "source {label} target".
// Parent/child is NOT a link — that's tickets.parent_id.
export const ticketLinks = pgTable(
  'ticket_links',
  {
    id: serial('id').primaryKey(),
    linkTypeId: integer('link_type_id')
      .notNull()
      .references(() => linkTypes.id),
    sourceTicketId: integer('source_ticket_id')
      .notNull()
      .references(() => tickets.id),
    targetTicketId: integer('target_ticket_id')
      .notNull()
      .references(() => tickets.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('ticket_links_edge').on(table.linkTypeId, table.sourceTicketId, table.targetTicketId),
    check('ticket_links_no_self', sql`source_ticket_id <> target_ticket_id`),
    index('ticket_links_source').on(table.sourceTicketId),
    index('ticket_links_target').on(table.targetTicketId),
  ],
);
