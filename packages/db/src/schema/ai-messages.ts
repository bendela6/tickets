import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { aiSessions } from './ai-sessions';

// One row per AgentEvent, the agent analogue of ai_session_output — same seq /
// persist-before-broadcast discipline, so a reconnecting browser replays the
// structured message stream exactly like terminal scrollback. `kind` is free
// text carrying the AgentEvent.type (assistant_text/thinking/tool_use/…),
// deliberately following the ticket_events.kind precedent — the vocabulary grows
// in app code, not in a migration. `parent_tool_use_id` attributes subagent
// output to the right nested pane.
export const aiMessages = pgTable(
  'ai_messages',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => aiSessions.id),
    seq: integer('seq').notNull(),
    role: text('role').notNull(),
    kind: text('kind').notNull(),
    content: jsonb('content')
      .notNull()
      .default(sql`'{}'::jsonb`),
    toolUseId: text('tool_use_id'),
    parentToolUseId: text('parent_tool_use_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('ai_messages_session_seq').on(table.sessionId, table.seq)],
);
