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
    key: 'structure',
    label: 'Schemes',
    color: 'indigo',
    tables: ['schemes', 'ticket_types'],
  },
  {
    key: 'owned',
    label: 'Type-owned config',
    color: 'teal',
    tables: [
      'fields',
      'field_options',
      'statuses',
      'status_transitions',
      'link_types',
      'link_type_target_types',
      'ticket_type_child_types',
    ],
  },
  {
    key: 'workspace',
    label: 'Workspace',
    color: 'blue',
    tables: ['projects', 'users', 'views'],
  },
  {
    key: 'records',
    label: 'Ticket data',
    color: 'orange',
    tables: [
      'tickets',
      'comments',
      'comment_reactions',
      'ticket_events',
      'ticket_values',
      'ticket_links',
    ],
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
