import { sql } from 'drizzle-orm';
import { integer, jsonb, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { agentSessions } from './agent-sessions';
import { permissionStatusEnum } from './enums';
import { agentSchema } from './schemas';
import { users } from './users';

// A pending row IS a `canUseTool` promise parked in the supervisor, waiting on a
// human — the session sits in `awaiting_input` until someone decides. The
// terminal transition records who decided and why.
export const agentPermissionRequests = agentSchema.table('permission_requests', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => agentSessions.id),
  toolName: text('tool_name').notNull(),
  input: jsonb('input')
    .notNull()
    .default(sql`'{}'::jsonb`),
  status: permissionStatusEnum('status').notNull().default('pending'),
  decisionReason: text('decision_reason'),
  decidedBy: integer('decided_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true, mode: 'string' }),
});
