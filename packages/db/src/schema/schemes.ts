import { sql } from 'drizzle-orm';
import { jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// A reusable structure bundle: owns ticket_types, fields, link_types.
// Projects bind to a scheme (projects.scheme_id); many projects may share one.
// config holds the default-view blueprint used to seed a project's first board.
export const schemes = pgTable('schemes', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  config: jsonb('config')
    .notNull()
    .default(sql`'{}'::jsonb`),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
