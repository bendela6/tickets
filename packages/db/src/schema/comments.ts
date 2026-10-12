import { sql } from 'drizzle-orm';
import {
  check, index, integer, serial, text, timestamp, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { items } from './items';
import { recordsSchema } from './schemas';
import { users } from './users';

export const comments = recordsSchema.table(
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
    // A note on a fragment of the item's description: the fragment as it was
    // selected (whitespace collapsed, at most 1000 characters), and which place
    // of it, from 0, when the description has it more than once. Set on the
    // comment that starts a thread; its replies carry the same pair.
    quote: text('quote'),
    nth: integer('nth'),
    // Its author deleted it: it leaves every list and read, and its
    // comment.added event stays. Replies under it stay too.
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [
    index('comments_item').on(t.itemId),
    check(
      'comments_quote_nth',
      sql`(quote IS NULL AND nth IS NULL) OR (quote IS NOT NULL AND nth >= 0)`,
    ),
  ],
);
