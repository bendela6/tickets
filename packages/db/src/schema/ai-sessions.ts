import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { aiWorkspaces } from './ai-workspaces';
import { sessionKindEnum, sessionStatusEnum } from './enums';
import { tickets } from './tickets';
import { users } from './users';

// The spine shared by both session kinds. agent_id, ticket_id, and
// parent_session_id exist from E1 but stay null until E2/E3 — that is what makes
// the later slices additive rather than migrations of live data.
//
// agent_id has no FK yet: ai_agents is created in E2, which adds the constraint.
export const aiSessions = pgTable(
  'ai_sessions',
  {
    id: serial('id').primaryKey(),
    kind: sessionKindEnum('kind').notNull(),
    title: text('title').notNull(),
    workspaceId: integer('workspace_id')
      .notNull()
      .references(() => aiWorkspaces.id),
    // FK added in E2 when ai_agents exists.
    agentId: integer('agent_id'),
    ticketId: integer('ticket_id').references(() => tickets.id),
    parentSessionId: integer('parent_session_id').references((): AnyPgColumn => aiSessions.id),
    status: sessionStatusEnum('status').notNull().default('starting'),
    // The provider's own session id (for resume). Null for terminal sessions.
    providerSessionId: text('provider_session_id'),
    cwd: text('cwd'),
    // Set for a dispatched run that gets its own git worktree — E3.
    worktreePath: text('worktree_path'),
    exitCode: integer('exit_code'),
    costUsd: numeric('cost_usd', { precision: 10, scale: 4 }),
    startedBy: integer('started_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('ai_sessions_status_created').on(table.status, table.createdAt),
    index('ai_sessions_parent').on(table.parentSessionId),
  ],
);
