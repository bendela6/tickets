import { sql } from 'drizzle-orm';
import { bigint, index, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { events } from './events';
import { historySchema } from './schemas';

// One row per event, written in the same transaction. A single worker drains it
// in id order (sub-project 3).
export const outbox = historySchema.table(
  'outbox',
  {
    eventId: bigint('event_id', { mode: 'number' })
      .primaryKey()
      .references(() => events.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    pickedAt: timestamp('picked_at', { withTimezone: true, mode: 'string' }),
    doneAt: timestamp('done_at', { withTimezone: true, mode: 'string' }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [index('outbox_pending').on(t.eventId).where(sql`done_at IS NULL`)],
);
