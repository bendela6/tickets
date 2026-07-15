import { integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { aiSessions } from './ai-sessions';

// Append-only raw PTY output, one row per persisted chunk. `seq` is the single
// source of truth shared by these rows and the wire frames: a client that has
// seen seq=N can always be brought current from the DB alone (persist BEFORE
// broadcast). A reconnecting browser replays rows with seq > lastSeq to rebuild
// its scrollback. Capped by the supervisor so a chatty process can't grow it
// unbounded.
export const aiSessionOutput = pgTable(
  'ai_session_output',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => aiSessions.id),
    seq: integer('seq').notNull(),
    data: text('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  // The unique constraint doubles as the (session_id, seq) index that the
  // replay query — WHERE session_id = ? AND seq > ? ORDER BY seq — walks.
  (table) => [unique('ai_session_output_session_seq').on(table.sessionId, table.seq)],
);
