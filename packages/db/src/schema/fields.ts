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
import { ticketTypes } from './ticket-types';

export const fields = pgTable(
  'fields',
  {
    id: serial('id').primaryKey(),
    ticketTypeId: integer('ticket_type_id')
      .notNull()
      .references(() => ticketTypes.id),
    position: integer('position').notNull(),
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
  (table) => [unique('fields_ticket_type_key').on(table.ticketTypeId, table.key)],
);
