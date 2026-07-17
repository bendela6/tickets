import { sql } from 'drizzle-orm';
import { jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { runnerKindEnum } from './enums';

// A directory a session runs in, plus how to run things there. `runner` picks
// the execution target; E1 only spawns `local`. container_name/git_remote/
// default_branch are for the container runner (E2) and worktree dispatch (E3).
export const aiWorkspaces = pgTable(
  'ai_workspaces',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    path: text('path').notNull(),
    runner: runnerKindEnum('runner').notNull().default('local'),
    containerName: text('container_name'),
    gitRemote: text('git_remote'),
    defaultBranch: text('default_branch'),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('ai_workspaces_name').on(table.name)],
);
