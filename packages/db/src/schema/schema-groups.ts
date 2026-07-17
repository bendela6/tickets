// packages/db/src/schema/schema-groups.ts

// A declared ownership group. `color` is an instrument option hue name.
// `tables` lists bare sql table names in render order, for tables that have
// no real Postgres schema yet (still `public`) — order of groups = layout
// order. `schemas` lists real Postgres schema names wholly owned by this
// group: membership for any table living in one of those schemas is DERIVED
// from `getTableConfig(table).schema`, not hand-listed, so a table can't be
// added to `terminal`/`agent`/etc. and silently fall out of its group the way
// a forgotten `tables` entry could. See resolveGroupKey in describe-schema.ts.
//
// Only `core`/`terminal`/`agent` are real schemas today — the 22
// items-platform tables still live in `public` pending a later plan, which is
// why `tables` still exists instead of every group deriving purely from
// pgSchema.
export type SchemaGroup = {
  key: string;
  label: string;
  color: string;
  tables: string[];
  schemas?: string[];
};

export const SCHEMA_GROUPS: SchemaGroup[] = [
  {
    key: 'ws',
    label: 'Workspace',
    color: 'blue',
    tables: ['users', 'projects', 'views'],
  },
  {
    key: 'st',
    label: 'Structure',
    color: 'indigo',
    tables: [
      'schemes',
      'item_types',
      'item_type_child_types',
      'item_type_fields',
      'fields',
      'option_sets',
      'options',
      'option_transitions',
      'link_types',
      'link_type_target_types',
    ],
  },
  {
    key: 'rc',
    label: 'Records',
    color: 'orange',
    tables: ['items', 'item_values', 'comments', 'comment_reactions', 'item_links'],
  },
  {
    key: 'hi',
    label: 'History',
    color: 'teal',
    tables: ['events', 'commands', 'outbox', 'item_activity'],
  },
  {
    key: 'ai',
    label: 'AI sessions',
    color: 'purple',
    // Nothing hand-listed: the legacy public `ai_*` tables are gone (Task 11)
    // and every table here now carries a real pgSchema. workdirs (core),
    // terminal.sessions/output and agent.sessions/messages/
    // permission_requests/agents all derive membership from `schemas`.
    tables: [],
    schemas: ['core', 'terminal', 'agent'],
  },
];
