import {
  index, integer, pgTable, serial, text, timestamp, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { items } from './items';
import { users } from './users';

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    parentId: integer('parent_id').references((): AnyPgColumn => comments.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('comments_item').on(t.itemId)],
);
