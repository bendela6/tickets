import { sql } from 'drizzle-orm';
import {
  check, index, integer, serial, timestamp, unique,
} from 'drizzle-orm/pg-core';
import { items } from './items';
import { linkTypes } from './link-types';
import { recordsSchema } from './schemas';

// Parent/child is NOT a link — that is items.parent_id.
export const itemLinks = recordsSchema.table(
  'item_links',
  {
    id: serial('id').primaryKey(),
    linkTypeId: integer('link_type_id')
      .notNull()
      .references(() => linkTypes.id),
    sourceItemId: integer('source_item_id')
      .notNull()
      .references(() => items.id),
    targetItemId: integer('target_item_id')
      .notNull()
      .references(() => items.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('item_links_unique').on(t.linkTypeId, t.sourceItemId, t.targetItemId),
    check('item_links_no_self', sql`source_item_id <> target_item_id`),
    index('item_links_source').on(t.sourceItemId),
    index('item_links_target').on(t.targetItemId),
  ],
);
