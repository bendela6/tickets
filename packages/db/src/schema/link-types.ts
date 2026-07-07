import { boolean, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { schemes } from './schemes';

// Data-driven relation vocabulary: blocks / relates-to / duplicates / …
export const linkTypes = pgTable(
  'link_types',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    schemeId: integer('scheme_id').references(() => schemes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    inverseLabel: text('inverse_label').notNull(),
    directional: boolean('directional').notNull(),
    position: integer('position').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [unique('link_types_project_key').on(table.projectId, table.key)],
);
