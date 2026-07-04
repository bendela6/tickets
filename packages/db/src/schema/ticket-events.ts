import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { tickets } from './tickets';
import { users } from './users';

// Append-only audit trail; written in the same transaction as the mutation it
// records. kind is text on purpose — the vocabulary grows in app code.
export const ticketEvents = pgTable(
  'ticket_events',
  {
    id: serial('id').primaryKey(),
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => tickets.id),
    actorId: integer('actor_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    payload: jsonb('payload')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('ticket_events_ticket_created').on(table.ticketId, table.createdAt)],
);
