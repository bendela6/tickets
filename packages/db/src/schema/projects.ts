import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  ticketPrefix: text('ticket_prefix').notNull(),
  schemeId: integer('scheme_id')
    .notNull()
    .references(() => schemes.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
