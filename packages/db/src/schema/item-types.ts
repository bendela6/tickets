import { sql } from 'drizzle-orm';
import { integer, jsonb, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';
import { structureSchema } from './schemas';

export const itemTypes = structureSchema.table(
  'item_types',
  {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id')
      .notNull()
      .references(() => schemes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    position: integer('position').notNull(),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [unique('item_types_scheme_key').on(t.schemeId, t.key)],
);
