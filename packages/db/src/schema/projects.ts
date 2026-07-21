import { integer, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';
import { coreSchema } from './schemas';

export const projects = coreSchema.table(
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
