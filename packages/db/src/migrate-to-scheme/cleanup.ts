import { eq, inArray, isNotNull } from 'drizzle-orm';
import { createDbClient } from '../client';
import {
  fieldOptions,
  fields,
  linkTypes,
  statusTransitions,
  statuses,
  ticketTypeFields,
  ticketTypes,
} from '../schema';

// Deletes the legacy per-project config rows (project_id NOT NULL) now that every
// ticket has been remapped onto the scheme. Safe only after run.ts + an all-zero
// verify. FK order: children first.
const { db, sql } = createDbClient({ max: 1 });

const oldTypeIds = (await db.select().from(ticketTypes).where(isNotNull(ticketTypes.projectId))).map((t) => t.id);
const oldFieldIds = (await db.select().from(fields).where(isNotNull(fields.projectId))).map((f) => f.id);
const oldStatusIds = (await db.select().from(statuses).where(isNotNull(statuses.projectId))).map((s) => s.id);

if (oldStatusIds.length) {
  await db.delete(statusTransitions).where(inArray(statusTransitions.toStatusId, oldStatusIds));
}
if (oldFieldIds.length) {
  await db.delete(fieldOptions).where(inArray(fieldOptions.fieldId, oldFieldIds));
}
if (oldTypeIds.length) {
  await db.delete(ticketTypeFields).where(inArray(ticketTypeFields.ticketTypeId, oldTypeIds));
}
await db.delete(statuses).where(isNotNull(statuses.projectId));
await db.delete(fields).where(isNotNull(fields.projectId));
await db.delete(ticketTypes).where(isNotNull(ticketTypes.projectId));
await db.delete(linkTypes).where(isNotNull(linkTypes.projectId));

const remaining = {
  types: (await db.select().from(ticketTypes).where(isNotNull(ticketTypes.projectId))).length,
  fields: (await db.select().from(fields).where(isNotNull(fields.projectId))).length,
  statuses: (await db.select().from(statuses).where(isNotNull(statuses.projectId))).length,
  linkTypes: (await db.select().from(linkTypes).where(isNotNull(linkTypes.projectId))).length,
};
console.log('CLEANUP', JSON.stringify(remaining));
await sql.end();
