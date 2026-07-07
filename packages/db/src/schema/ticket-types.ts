import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';

export const ticketTypes = pgTable(
  'ticket_types',
  {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id')
      .notNull()
      .references(() => schemes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    position: integer('position').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('ticket_types_scheme_key').on(table.schemeId, table.key)],
);
