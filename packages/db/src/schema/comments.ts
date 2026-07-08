import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { tickets } from './tickets';
import { users } from './users';

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => tickets.id),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    // reply threading; null = top-level comment. Depth policy enforced in the API.
    parentId: integer('parent_id').references((): AnyPgColumn => comments.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('comments_ticket').on(table.ticketId),
    index('comments_parent').on(table.parentId),
  ],
);
