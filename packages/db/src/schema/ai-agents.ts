import { sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { permissionModeEnum } from './enums';
import { users } from './users';
import { workdirs } from './workdirs';

// The persona library. Each agent OWNS a users row with kind='agent' (user_id) —
// that is what makes a persona assignable to a ticket and attributable in events
// with zero changes to the ticket system. provider_key selects a code-registered
// AgentProvider (not a DB row); model/system_prompt/tools/permission_mode/effort
// are the RunSpec the supervisor starts it with.
export const aiAgents = pgTable(
  'ai_agents',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references((): AnyPgColumn => users.id),
    key: text('key').notNull(),
    name: text('name').notNull(),
    providerKey: text('provider_key').notNull(),
    model: text('model').notNull(),
    systemPrompt: text('system_prompt'),
    // Tool allow/deny lists and MCP server config are provider-shaped blobs.
    allowedTools: jsonb('allowed_tools')
      .notNull()
      .default(sql`'[]'::jsonb`),
    disallowedTools: jsonb('disallowed_tools')
      .notNull()
      .default(sql`'[]'::jsonb`),
    permissionMode: permissionModeEnum('permission_mode').notNull().default('bypassPermissions'),
    mcpServers: jsonb('mcp_servers')
      .notNull()
      .default(sql`'{}'::jsonb`),
    effort: text('effort'),
    defaultWorkspaceId: integer('default_workspace_id').references(() => workdirs.id),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('ai_agents_key').on(table.key)],
);
