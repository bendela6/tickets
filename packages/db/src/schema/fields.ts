import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { fieldTypeEnum } from './enums';
import { projects } from './projects';
import { schemes } from './schemes';

export const fields = pgTable(
  'fields',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id').references(() => projects.id),
    schemeId: integer('scheme_id').references(() => schemes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    type: fieldTypeEnum('type').notNull(),
    // system fields are seeded, undeletable, and type-locked — enforced in the API
    system: boolean('system').notNull().default(false),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('fields_project_key').on(table.projectId, table.key)],
);
