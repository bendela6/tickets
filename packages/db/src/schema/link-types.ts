import { boolean, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { itemTypes } from './item-types';

export const linkTypes = pgTable(
  'link_types',
  {
    id: serial('id').primaryKey(),
    itemTypeId: integer('item_type_id')
      .notNull()
      .references(() => itemTypes.id),
    key: text('key').notNull(),
    label: text('label').notNull(),
    inverseLabel: text('inverse_label').notNull(),
    directional: boolean('directional').notNull(),
    position: integer('position').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [unique('link_types_type_key').on(t.itemTypeId, t.key)],
);
