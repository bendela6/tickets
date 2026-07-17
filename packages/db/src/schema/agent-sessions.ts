import { type AnyPgColumn, index, integer, numeric, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { agentAgents } from './agent-agents';
import { agentStatusEnum } from './enums';
import { items } from './items';
import { agentSchema } from './schemas';
import { users } from './users';
import { workdirs } from './workdirs';

// The spine of an agent run. No `kind` — this schema only ever holds agent
// sessions, so the discriminator that used to split terminal from agent rows
// is gone. No `exit_code` — an agent run has a result the messages/status
// carry, not a process exit status; that's a PTY fact and stays on
// terminal.sessions.
export const agentSessions = agentSchema.table(
  'sessions',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    workdirId: integer('workdir_id').notNull().references(() => workdirs.id),
    agentId: integer('agent_id').references((): AnyPgColumn => agentAgents.id),
    itemId: integer('item_id').references(() => items.id),
    parentSessionId: integer('parent_session_id').references((): AnyPgColumn => agentSessions.id),
    status: agentStatusEnum('status').notNull().default('starting'),
    providerSessionId: text('provider_session_id'),
    cwd: text('cwd'),
    worktreePath: text('worktree_path'),
    costUsd: numeric('cost_usd', { precision: 10, scale: 4 }),
    startedBy: integer('started_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [
    index('agent_sessions_status_created').on(t.status, t.createdAt),
    index('agent_sessions_parent').on(t.parentSessionId),
  ],
);
