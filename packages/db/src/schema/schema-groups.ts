// packages/db/src/schema/schema-groups.ts

// A declared ownership group. `color` is an instrument option hue name.
// `tables` lists sql table names in render order. Order of groups = layout order.
export type SchemaGroup = {
  key: string;
  label: string;
  color: string;
  tables: string[];
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
    tables: [
      'ai_workspaces',
      'ai_agents',
      'ai_sessions',
      'ai_messages',
      'ai_session_output',
      'ai_permission_requests',
    ],
  },
];
