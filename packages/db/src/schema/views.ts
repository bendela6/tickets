import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const views = pgTable('views', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name').notNull(),
  position: integer('position').notNull(),
  config: jsonb('config')
    .notNull()
    .default(sql`'{}'::jsonb`),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
});
