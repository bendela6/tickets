// packages/db/src/schema/registry.ts
import { commands } from './commands';
import { commentReactions } from './comment-reactions';
import { comments } from './comments';
import { fieldTypeEnum, statusKindEnum, userKindEnum } from './enums';
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
import { users } from './users';
import { views } from './views';

// Every pgTable in the schema. The conformance test forces this to equal the
// entity set in apps/eer/models/items-platform.json.
export const allTables = [
  users, projects, views,
  schemes, itemTypes, itemTypeChildTypes, itemTypeFields, fields,
  optionSets, options, optionTransitions, linkTypes, linkTypeTargetTypes,
  items, itemValues, comments, commentReactions, itemLinks,
  events, commands, outbox, itemActivity,
];

export const allEnums = [userKindEnum, statusKindEnum, fieldTypeEnum];
