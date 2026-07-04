import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';

// How tickets are displayed: config holds { columns, sort, filters } and
// references fields by ID (never key) so renames can't break a view.
export const views = pgTable('views', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name').notNull(),
  config: jsonb('config')
    .notNull()
    .default(sql`'{}'::jsonb`),
  position: integer('position').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
