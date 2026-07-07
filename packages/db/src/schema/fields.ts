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
import { schemes } from './schemes';
import { ticketTypes } from './ticket-types';

export const fields = pgTable(
  'fields',
  {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id').references(() => schemes.id),
    ticketTypeId: integer('ticket_type_id').references(() => ticketTypes.id),
    position: integer('position'),
    required: boolean('required').notNull().default(false),
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
  (table) => [unique('fields_scheme_key').on(table.schemeId, table.key)],
);
