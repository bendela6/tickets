import { eq, inArray } from 'drizzle-orm';
import { createDbClient } from '../client';
import {
  fields,
  linkTypes,
  schemes,
  statuses,
  ticketLinks,
  ticketTypes,
  ticketValues,
  tickets,
} from '../schema';

const { db, sql } = createDbClient({ max: 1 });
const [software] = await db.select().from(schemes).where(eq(schemes.key, 'software'));
const schemeTypes = await db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, software!.id));
const typeIds = new Set(schemeTypes.map((t) => t.id));
const schemeStatuses = await db
  .select()
  .from(statuses)
  .where(
    inArray(
      statuses.ticketTypeId,
      schemeTypes.map((t) => t.id),
    ),
  );
const statusTypeById = new Map(schemeStatuses.map((s) => [s.id, s.ticketTypeId]));
const schemeFieldIds = new Set(
  (await db.select().from(fields).where(eq(fields.schemeId, software!.id))).map((f) => f.id),
);

const schemeLinkIds = new Set(
  (await db.select().from(linkTypes).where(eq(linkTypes.schemeId, software!.id))).map((l) => l.id),
);

const allTickets = await db.select().from(tickets);
let badType = 0;
let badStatus = 0;
let badField = 0;
for (const t of allTickets) {
  if (!typeIds.has(t.typeId)) badType++;
  const vals = await db.select().from(ticketValues).where(eq(ticketValues.ticketId, t.id));
  for (const v of vals) {
    if (!schemeFieldIds.has(v.fieldId)) badField++;
    if (v.statusId != null && statusTypeById.get(v.statusId) !== t.typeId) badStatus++;
  }
}
const badLink = (await db.select().from(ticketLinks)).filter((l) => !schemeLinkIds.has(l.linkTypeId)).length;
console.log(JSON.stringify({ tickets: allTickets.length, badType, badStatus, badField, badLink }));
await sql.end();
