import { integer, jsonb, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { runnerKindEnum } from './enums';
import { projects } from './projects';
import { coreSchema } from './schemas';

// A directory sessions run in. It may belong to a project, or stand alone
// (a scratch clone, an unrelated repo) — hence the nullable project_id.
export const workdirs = coreSchema.table('workdirs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  name: text('name').notNull(),
  path: text('path').notNull(),
  runner: runnerKindEnum('runner').notNull().default('local'),
  containerName: text('container_name'),
  gitRemote: text('git_remote'),
  defaultBranch: text('default_branch'),
  config: jsonb('config'),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
