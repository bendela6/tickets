import { integer, pgTable, serial, text, unique } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';

export const optionSets = pgTable(
  'option_sets',
  {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id')
      .notNull()
      .references(() => schemes.id),
    key: text('key').notNull(),
    name: text('name').notNull(),
  },
  (t) => [unique('option_sets_scheme_key').on(t.schemeId, t.key)],
);
