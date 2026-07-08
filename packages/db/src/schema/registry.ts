// packages/db/src/schema/registry.ts
import { comments } from './comments';
import { commentReactions } from './comment-reactions';
import { fieldOptions } from './field-options';
import { fields } from './fields';
import { linkTypeTargetTypes } from './link-type-target-types';
import { linkTypes } from './link-types';
import { projects } from './projects';
import { schemes } from './schemes';
import { statusTransitions } from './status-transitions';
import { statuses } from './statuses';
import { ticketEvents } from './ticket-events';
import { ticketLinks } from './ticket-links';
import { ticketTypeChildTypes } from './ticket-type-child-types';
import { ticketTypes } from './ticket-types';
import { ticketValues } from './ticket-values';
import { tickets } from './tickets';
import { users } from './users';
import { views } from './views';

// Every pgTable in the schema. Add new tables here; the group invariant test
// then forces them into SCHEMA_GROUPS.
export const allTables = [
  schemes, ticketTypes, ticketTypeChildTypes,
  fields, fieldOptions, statuses, statusTransitions, linkTypes, linkTypeTargetTypes,
  projects, users, views,
  tickets, comments, commentReactions, ticketEvents, ticketValues, ticketLinks,
];
