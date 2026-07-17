import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

// Idempotency ledger: a retried commandId collides here and the command is a no-op.
export const commands = pgTable('commands', {
  id: uuid('id').primaryKey(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: integer('aggregate_id').notNull(),
  actorId: integer('actor_id')
    .notNull()
    .references(() => users.id),
  at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  result: jsonb('result'),
});
