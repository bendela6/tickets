import { integer, serial, text, unique } from 'drizzle-orm/pg-core';
import { structureSchema } from './schemas';
import { schemes } from './schemes';

export const optionSets = structureSchema.table(
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
