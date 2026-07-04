import {
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { ticketTypes } from './ticket-types';
import { users } from './users';

// Pure skeleton — everything user-visible lives in ticket_values.
export const tickets = pgTable(
  'tickets',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    typeId: integer('type_id')
      .notNull()
      .references(() => ticketTypes.id),
    // depth-1 hierarchy: subtasks are child tickets; enforced in the API
    parentId: integer('parent_id').references((): AnyPgColumn => tickets.id),
    // display number (TASK-042); assigned max+1 under SELECT … FOR UPDATE on the project row
    number: integer('number').notNull(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    // doubles as the optimistic-lock token — always compare as text
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('tickets_project_number').on(table.projectId, table.number),
    index('tickets_project_type').on(table.projectId, table.typeId),
    index('tickets_parent').on(table.parentId),
  ],
);
