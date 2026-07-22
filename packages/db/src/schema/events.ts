import { sql } from 'drizzle-orm';
import {
  bigint, bigserial, check, index, integer, jsonb, text, timestamp, unique, uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { historySchema } from './schemas';
import { users } from './users';

// Global append-only log, one stream per (aggregate_type, aggregate_id).
// version 0 = imported legacy row: lossy, display-only, never folded.
export const events = historySchema.table(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: integer('aggregate_id').notNull(),
    seq: integer('seq').notNull(),
    kind: text('kind').notNull(),
    version: integer('version').notNull().default(1),
    payload: jsonb('payload')
      .notNull()
      .default(sql`'{}'::jsonb`),
    actorId: integer('actor_id')
      .notNull()
      .references(() => users.id),
    at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    commandId: uuid('command_id').notNull(),
    correlationId: uuid('correlation_id').notNull(),
    causedBy: bigint('caused_by', { mode: 'number' }).references((): AnyPgColumn => events.id),
    depth: integer('depth').notNull().default(0),
    projectId: integer('project_id'),
  },
  (t) => [
    // stream order AND the optimistic-concurrency backstop
    unique('events_stream_seq').on(t.aggregateType, t.aggregateId, t.seq),
    index('events_correlation').on(t.correlationId),
    // trace only — one command emits many events, so NOT unique
    index('events_command').on(t.aggregateType, t.aggregateId, t.commandId),
    index('events_caused_by').on(t.causedBy),
    index('events_project_at').on(t.projectId, t.at),
    index('events_stream_at').on(t.aggregateType, t.aggregateId, t.at),
    check('events_item_project', sql`aggregate_type <> 'item' OR project_id IS NOT NULL`),
  ],
);
