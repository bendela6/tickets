import { pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { userKindEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email'),
    kind: userKindEnum('kind').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [unique('users_name_unique').on(t.name)],
);
