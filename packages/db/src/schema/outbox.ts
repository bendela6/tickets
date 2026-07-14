import { sql } from 'drizzle-orm';
import { bigint, index, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { events } from './events';

// One row per event, written in the same transaction. A single worker drains it
// in id order (sub-project 3).
export const outbox = pgTable(
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
  },
  (t) => [index('outbox_pending').on(t.eventId).where(sql`done_at IS NULL`)],
);
