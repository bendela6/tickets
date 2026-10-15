// drizzle-kit only emits CREATE SCHEMA for schemas it sees exported from this
// entry point.
export {
  coreSchema,
  structureSchema,
  recordsSchema,
  historySchema,
} from './schemas';
export {
  userKindEnum,
  statusKindEnum,
  fieldTypeEnum,
} from './enums';
export { attachments } from './attachments';
export { users } from './users';
export { agentReports, AGENT_ROLES, AGENT_STATES } from './agent-reports';
export { projects } from './projects';
export { views } from './views';
export { schemes } from './schemes';
export { itemTypes } from './item-types';
export { itemTypeChildTypes } from './item-type-child-types';
export { itemTypeFields } from './item-type-fields';
export { fields } from './fields';
export { optionSets } from './option-sets';
export { options } from './options';
export { optionTransitions } from './option-transitions';
export { linkTypes } from './link-types';
export { linkTypeTargetTypes } from './link-type-target-types';
export { items } from './items';
export { itemValues } from './item-values';
export { comments } from './comments';
export { commentReactions } from './comment-reactions';
export { itemLinks } from './item-links';
export { events } from './events';
export { commands } from './commands';
export { outbox } from './outbox';
export { itemActivity } from './item-activity';

export { allTables, allEnums } from './registry';
export { SCHEMA_GROUPS, type SchemaGroup } from './schema-groups';
export {
  describeSchema,
  findGroupKey,
  resolveGroupKey,
  qualifiedName,
  type SchemaGraph,
  type TableMeta,
  type ColumnMeta,
  type UniqueMeta,
  type GroupMeta,
} from './describe-schema';
export { introspectDatabase } from './introspect/introspect-database';
export { listDatabases, assertKnownDatabase, UnknownDatabaseError } from './list-databases';
