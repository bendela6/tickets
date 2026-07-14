import { integer, pgTable, primaryKey, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { itemTypes } from './item-types';

export const itemTypeChildTypes = pgTable(
  'item_type_child_types',
  {
    parentTypeId: integer('parent_type_id')
      .notNull()
      .references((): AnyPgColumn => itemTypes.id),
    childTypeId: integer('child_type_id')
      .notNull()
      .references((): AnyPgColumn => itemTypes.id),
  },
  (t) => [primaryKey({ columns: [t.parentTypeId, t.childTypeId] })],
);
