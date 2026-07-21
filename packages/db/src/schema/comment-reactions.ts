import { integer, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { comments } from './comments';
import { recordsSchema } from './schemas';
import { users } from './users';

export const commentReactions = recordsSchema.table(
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
  (t) => [unique('comment_reactions_unique').on(t.commentId, t.userId, t.emoji)],
);
