import { integer, pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { ticketTypes } from './ticket-types';

// Allowed parent→child pairs for tickets.parent_id (e.g. epic→task, task→subtask).
// No rows for a parent type = that type allows no children. Promotes the former
// ticket_types.config.allowedChildTypes jsonb into first-class rows; mirrors
// link_type_target_types. Both columns reference ticket_types within one scheme.
export const ticketTypeChildTypes = pgTable(
  'ticket_type_child_types',
  {
    parentTypeId: integer('parent_type_id')
      .notNull()
      .references(() => ticketTypes.id),
    childTypeId: integer('child_type_id')
      .notNull()
      .references(() => ticketTypes.id),
  },
  (table) => [primaryKey({ columns: [table.parentTypeId, table.childTypeId] })],
);
