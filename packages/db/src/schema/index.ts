// drizzle-kit only emits CREATE SCHEMA for schemas it sees exported from this
// entry point. terminalSchema and agentSchema graduated with the terminal/agent
// split; structureSchema/recordsSchema/historySchema graduated with the
// core/structure/records/history namespacing — all six now own real tables.
export {
  coreSchema,
  terminalSchema,
  agentSchema,
  structureSchema,
  recordsSchema,
  historySchema,
} from './schemas';
export {
  userKindEnum,
  statusKindEnum,
  fieldTypeEnum,
  runnerKindEnum,
  terminalStatusEnum,
  agentStatusEnum,
  permissionModeEnum,
  permissionStatusEnum,
} from './enums';
export { attachments } from './attachments';
export { users } from './users';
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
export { workdirs } from './workdirs';
export { terminalSessions, terminalOutput } from './terminal-sessions';
export { agentSessions } from './agent-sessions';
export { agentMessages } from './agent-messages';
export { agentPermissionRequests } from './agent-permission-requests';
export { agentAgents } from './agent-agents';

export { allTables, allEnums } from './registry';
export { SCHEMA_GROUPS, type SchemaGroup } from './schema-groups';
export {
  describeSchema,
  resolveGroupKey,
  qualifiedName,
  type SchemaGraph,
  type TableMeta,
  type ColumnMeta,
  type UniqueMeta,
  type GroupMeta,
} from './describe-schema';
