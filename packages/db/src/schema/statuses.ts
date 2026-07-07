import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { statusKindEnum } from './enums';
import { projects } from './projects';
import { ticketTypes } from './ticket-types';

export const statuses = pgTable(
  'statuses',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id').references(() => projects.id),
    ticketTypeId: integer('ticket_type_id').references(() => ticketTypes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    kind: statusKindEnum('kind').notNull(),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    position: integer('position').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('statuses_project_key').on(table.projectId, table.key)],
);
