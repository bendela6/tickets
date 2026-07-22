import { sql } from 'drizzle-orm';
import { integer, jsonb, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { statusKindEnum } from './enums';
import { optionSets } from './option-sets';
import { structureSchema } from './schemas';

export const options = structureSchema.table(
  'options',
  {
    id: serial('id').primaryKey(),
    optionSetId: integer('option_set_id')
      .notNull()
      .references(() => optionSets.id),
    value: text('value').notNull(),
    label: text('label').notNull(),
    position: integer('position').notNull(),
    // null on non-workflow options (priority, labels, component, …)
    kind: statusKindEnum('kind'),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [unique('options_set_value').on(t.optionSetId, t.value)],
);
