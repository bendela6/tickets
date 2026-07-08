import { index, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { comments } from './comments';
import { users } from './users';

// One row per person per emoji on a comment; toggling a reaction inserts/deletes
// a row. The unique constraint makes a double-tap idempotent.
export const commentReactions = pgTable(
  'comment_reactions',
  {
    id: serial('id').primaryKey(),
    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('comment_reactions_comment_user_emoji').on(table.commentId, table.userId, table.emoji),
    index('comment_reactions_comment').on(table.commentId),
  ],
);
