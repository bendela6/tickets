import { integer, pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { itemTypes } from './item-types';
import { linkTypes } from './link-types';

export const linkTypeTargetTypes = pgTable(
  'link_type_target_types',
  {
    linkTypeId: integer('link_type_id')
      .notNull()
      .references(() => linkTypes.id),
    targetTypeId: integer('target_type_id')
      .notNull()
      .references(() => itemTypes.id),
  },
  (t) => [primaryKey({ columns: [t.linkTypeId, t.targetTypeId] })],
);
