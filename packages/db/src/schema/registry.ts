// packages/db/src/schema/registry.ts
import { agentAgents } from './agent-agents';
import { agentMessages } from './agent-messages';
import { agentPermissionRequests } from './agent-permission-requests';
import { agentSessions } from './agent-sessions';
import { attachments } from './attachments';
import { commands } from './commands';
import { commentReactions } from './comment-reactions';
import { comments } from './comments';
import {
  agentStatusEnum,
  fieldTypeEnum,
  permissionModeEnum,
  permissionStatusEnum,
  runnerKindEnum,
  statusKindEnum,
  terminalStatusEnum,
  userKindEnum,
} from './enums';
import { events } from './events';
import { fields } from './fields';
import { itemActivity } from './item-activity';
import { itemLinks } from './item-links';
import { itemTypeChildTypes } from './item-type-child-types';
import { itemTypeFields } from './item-type-fields';
import { itemTypes } from './item-types';
import { itemValues } from './item-values';
import { items } from './items';
import { linkTypeTargetTypes } from './link-type-target-types';
import { linkTypes } from './link-types';
import { optionSets } from './option-sets';
import { optionTransitions } from './option-transitions';
import { options } from './options';
import { outbox } from './outbox';
import { projects } from './projects';
import { schemes } from './schemes';
import { terminalOutput, terminalSessions } from './terminal-sessions';
import { users } from './users';
import { views } from './views';
import { workdirs } from './workdirs';

// Every pgTable in the schema. The conformance test forces this to equal the
// entity set in packages/db/src/schema/items-platform.json.
export const allTables = [
  users, projects, views,
  schemes, itemTypes, itemTypeChildTypes, itemTypeFields, fields,
  optionSets, options, optionTransitions, linkTypes, linkTypeTargetTypes,
  items, itemValues, comments, commentReactions, itemLinks, attachments,
  events, commands, outbox, itemActivity,
  workdirs,
  terminalSessions, terminalOutput,
  agentSessions, agentMessages, agentPermissionRequests, agentAgents,
];

// Every enum must also be exported from index.ts — drizzle omits the CREATE TYPE
// for an enum it cannot see there.
export const allEnums = [
  userKindEnum,
  statusKindEnum,
  fieldTypeEnum,
  runnerKindEnum,
  terminalStatusEnum,
  agentStatusEnum,
  permissionModeEnum,
  permissionStatusEnum,
];
