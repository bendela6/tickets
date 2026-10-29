// packages/db/src/schema/schema-groups.ts

// A declared ownership group. `color` is an instrument option hue name.
// `tables` lists bare sql table names in render order — order of groups =
// layout order. A hand-listed `tables` entry always wins group membership,
// regardless of the table's real Postgres schema: the ERD's visual grouping
// (WORKSPACE/STRUCTURE/RECORDS/HISTORY) is a display concern independent of
// schema namespacing, e.g. `core.users` renders in WORKSPACE whatever its
// schema. `schemas` lists real Postgres schema
// names wholly owned by a group with no hand-listed tables: membership for
// any table living in one of those schemas is DERIVED from
// `getTableConfig(table).schema`, so a table can't be added to
// a schema-owned group and silently fall out of it the way a
// forgotten `tables` entry could. See resolveGroupKey in describe-schema.ts.
//
// A group owns at most one real schema today, but `schemas` stays a list:
// nothing about the model forbids two, and resolveGroupKey already rejects
// the reverse (one schema claimed by two groups).
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
    tables: ['items', 'item_values', 'comments', 'comment_reactions', 'item_links', 'attachments'],
  },
  {
    key: 'hi',
    label: 'History',
    color: 'teal',
    tables: ['events', 'commands', 'outbox', 'item_activity'],
  },
];
