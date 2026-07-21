import { bigint, bigserial, index, integer, jsonb, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { events } from './events';
import { items } from './items';
import { historySchema } from './schemas';
import { users } from './users';

// Feed projection — source events are value-only, so the diff is computed on
// fold and denormalised here. Built in sub-project 3; empty until then.
export const itemActivity = historySchema.table(
  'item_activity',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    eventId: bigint('event_id', { mode: 'number' })
      .notNull()
      .references(() => events.id),
    projectId: integer('project_id').notNull(),
    kind: text('kind').notNull(),
    actorId: integer('actor_id')
      .notNull()
      .references(() => users.id),
    at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
    summary: jsonb('summary').notNull(),
  },
  (t) => [
    unique('item_activity_event').on(t.eventId),
    index('item_activity_item_at').on(t.itemId, t.at),
    index('item_activity_correlation').on(t.correlationId),
  ],
);
