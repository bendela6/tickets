import { coreSchema, structureSchema } from './schemas';

export const userKindEnum = coreSchema.enum('user_kind', ['human', 'agent']);

// The one workflow semantic code knows: what counts as done/active for tiles,
// progress rollups and filter buckets. Lives on options.kind (nullable — only
// workflow options carry it).
export const statusKindEnum = structureSchema.enum('status_kind', [
  'todo',
  'active',
  'blocked',
  'done',
  'dropped',
]);

// Format (url/email/markdown) and cardinality (multiple) ride in fields.config,
// not in the type. There is no 'status' type — a workflow status is an option
// field whose option set carries kinds and whose graph is option_transitions.
export const fieldTypeEnum = structureSchema.enum('field_type', [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'option',
  'user',
  'json',
]);
