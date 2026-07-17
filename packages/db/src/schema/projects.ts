import { integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';

export const projects = pgTable(
  'projects',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    itemPrefix: text('item_prefix').notNull(),
    schemeId: integer('scheme_id')
      .notNull()
      .references(() => schemes.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique('projects_key_unique').on(t.key)],
);
