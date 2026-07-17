// agentSchema is declared in ./schemas for Task 5 to import directly, but stays
// unexported here until a real table uses it — drizzle-kit only emits CREATE
// SCHEMA for schemas it sees exported from this entry point, and the eer
// round-trip gate would (rightly) flag an empty schema the SSOT model doesn't
// know about yet. terminalSchema graduated in Task 4: it now owns real tables.
export { coreSchema, terminalSchema } from './schemas';
export {
  userKindEnum,
  statusKindEnum,
  fieldTypeEnum,
  sessionKindEnum,
  sessionStatusEnum,
  runnerKindEnum,
  permissionModeEnum,
  permissionStatusEnum,
  terminalStatusEnum,
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
export { terminalSessions, terminalOutput } from './terminal-sessions';

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
