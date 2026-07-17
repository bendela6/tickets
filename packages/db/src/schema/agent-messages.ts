import { sql } from 'drizzle-orm';
import { integer, jsonb, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { agentSessions } from './agent-sessions';
import { agentSchema } from './schemas';

// One row per AgentEvent, the agent analogue of terminal.output — same seq /
// persist-before-broadcast discipline, so a reconnecting browser replays the
// structured message stream exactly like terminal scrollback. `kind` is free
// text carrying the AgentEvent.type (assistant_text/thinking/tool_use/…),
// deliberately following the ticket_events.kind precedent — the vocabulary grows
// in app code, not in a migration. `parent_tool_use_id` attributes subagent
// output to the right nested pane.
export const agentMessages = agentSchema.table(
  'messages',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => agentSessions.id),
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
  (table) => [unique('agent_messages_session_seq').on(table.sessionId, table.seq)],
);
