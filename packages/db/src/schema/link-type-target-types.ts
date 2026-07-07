import { integer, pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { linkTypes } from './link-types';
import { ticketTypes } from './ticket-types';

// Valid target types for a (source-type-owned) link type.
export const linkTypeTargetTypes = pgTable(
  'link_type_target_types',
  {
    linkTypeId: integer('link_type_id')
      .notNull()
      .references(() => linkTypes.id),
    targetTypeId: integer('target_type_id')
      .notNull()
      .references(() => ticketTypes.id),
  },
  (table) => [primaryKey({ columns: [table.linkTypeId, table.targetTypeId] })],
);
