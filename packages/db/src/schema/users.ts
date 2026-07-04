import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { userKindEnum } from './enums';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  email: text('email'),
  kind: userKindEnum('kind').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
