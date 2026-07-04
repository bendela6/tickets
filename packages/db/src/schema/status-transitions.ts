import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, unique } from 'drizzle-orm/pg-core';
import { statuses } from './statuses';
import { ticketTypes } from './ticket-types';

// The workflow graph. from_status_id NULL = a valid starting status for new
// tickets; ticket_type_id NULL = the edge applies to all types. A project with
// zero rows has an unrestricted workflow.
export const statusTransitions = pgTable(
  'status_transitions',
  {
    id: serial('id').primaryKey(),
    fromStatusId: integer('from_status_id').references(() => statuses.id),
    toStatusId: integer('to_status_id')
      .notNull()
      .references(() => statuses.id),
    ticketTypeId: integer('ticket_type_id').references(() => ticketTypes.id),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [
    unique('status_transitions_edge')
      .on(table.fromStatusId, table.toStatusId, table.ticketTypeId)
      .nullsNotDistinct(),
  ],
);
