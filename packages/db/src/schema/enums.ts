import { pgEnum } from 'drizzle-orm/pg-core';

export const userKindEnum = pgEnum('user_kind', ['human', 'agent']);

// The only hardcoded workflow semantic in the system: code must know what counts
// as done/active for tiles, progress rollups, and filter buckets.
export const statusKindEnum = pgEnum('status_kind', [
  //
  'todo',
  'active',
  'blocked',
  'done',
  'dropped',
]);

export const fieldTypeEnum = pgEnum('field_type', [
  //
  'text',
  'number',
  'date',
  'boolean',
  'json',
  'select',
  'multi_select',
  'status',
]);
