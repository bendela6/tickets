import { sql } from 'drizzle-orm';
import { jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const schemes = pgTable(
  'schemes',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [unique('schemes_key_unique').on(t.key)],
);
