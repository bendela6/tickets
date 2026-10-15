import { sql } from 'drizzle-orm';
import { check, text, timestamp } from 'drizzle-orm/pg-core';
import { coreSchema } from './schemas';

export const AGENT_ROLES = ['planner', 'builder', 'worker'] as const;
export const AGENT_STATES = ['listening', 'working', 'done', 'failed', 'abandoned', 'stopped'] as const;

// What each agent working on the plans last said it is doing (TK-84.1): one row
// per agent, written over by its next word, and gone a week after its last.
// Not a command: an agent speaks at every step and the builder every 20
// seconds, which would fill the history with nothing, so the api writes this
// table directly (apps/api/src/agents/reports.ts).
//
// `item` is the item as the agent named it. It names a tickets item when it is
// one's key (records.items.key, unique and never changed), which the api looks
// up as it reads; a plans id that is no item's key (`TK-7.2` while the plans
// live in tasks/*.json) is kept all the same, linked to nothing.
export const agentReports = coreSchema.table(
  'agent_reports',
  {
    // worker-tk-7, planner, builder
    name: text('name').primaryKey(),
    role: text('role').notNull(),
    state: text('state').notNull(),
    item: text('item'),
    text: text('text').notNull().default(''),
    // when it last said anything
    at: timestamp('at', { withTimezone: true, mode: 'date' }).notNull(),
    // since when its state and its item have been what they are
    since: timestamp('since', { withTimezone: true, mode: 'date' }).notNull(),
  },
  () => [
    // the two lists above
    check('agent_reports_role', sql`role IN ('planner', 'builder', 'worker')`),
    check(
      'agent_reports_state',
      sql`state IN ('listening', 'working', 'done', 'failed', 'abandoned', 'stopped')`,
    ),
    check('agent_reports_text', sql`char_length(text) <= 300`),
  ],
);
