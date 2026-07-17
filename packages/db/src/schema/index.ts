// terminalSchema/agentSchema are declared in ./schemas for Tasks 4-5 to import
// directly, but stay unexported here until a real table uses them — drizzle-kit
// only emits CREATE SCHEMA for schemas it sees exported from this entry point,
// and the eer round-trip gate would (rightly) flag an empty schema the SSOT
// model doesn't know about yet.
export { coreSchema } from './schemas';
export {
  userKindEnum,
  statusKindEnum,
  fieldTypeEnum,
  sessionKindEnum,
  sessionStatusEnum,
  runnerKindEnum,
  permissionModeEnum,
  permissionStatusEnum,
} from './enums';
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
export { aiSessions } from './ai-sessions';
export { aiSessionOutput } from './ai-session-output';
export { aiAgents } from './ai-agents';
export { aiMessages } from './ai-messages';
export { aiPermissionRequests } from './ai-permission-requests';

export { allTables, allEnums } from './registry';
export { SCHEMA_GROUPS, type SchemaGroup } from './schema-groups';
export {
  describeSchema,
  resolveGroupKey,
  type SchemaGraph,
  type TableMeta,
  type ColumnMeta,
  type UniqueMeta,
  type GroupMeta,
} from './describe-schema';
