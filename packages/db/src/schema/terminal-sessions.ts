import { index, integer, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { terminalStatusEnum } from './enums';
import { terminalSchema } from './schemas';
import { users } from './users';
import { workdirs } from './workdirs';

export const terminalSessions = terminalSchema.table(
  'sessions',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    workdirId: integer('workdir_id').notNull().references(() => workdirs.id),
    cwd: text('cwd'),
    // The resolved shell/command this session was launched with, so Restart can
    // respawn the same process on the same record (null for pre-restart rows and
    // sessions started before this column existed → Restart falls back to the
    // default shell in `cwd`).
    command: text('command'),
    status: terminalStatusEnum('status').notNull().default('starting'),
    exitCode: integer('exit_code'),
    startedBy: integer('started_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [index('terminal_sessions_status_created').on(t.status, t.createdAt)],
);

export const terminalOutput = terminalSchema.table('output', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => terminalSessions.id),
  seq: integer('seq').notNull(),
  data: text('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
