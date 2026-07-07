import { count, eq, inArray } from 'drizzle-orm';
import { createDbClient } from '../client';
import { fields, linkTypes, statuses, ticketTypes } from '../schema';
import { seedScheme } from './seed-scheme';
import { SOFTWARE_SCHEME } from './software-scheme';

const { db, sql } = createDbClient({ max: 1 });
const { schemeId, typeIdByKey } = await seedScheme(db, {
  ...SOFTWARE_SCHEME,
  key: `software-verify-${Date.now()}`,
});

const typeIds = Object.values(typeIdByKey);
const [t] = await db.select({ n: count() }).from(ticketTypes).where(eq(ticketTypes.schemeId, schemeId));
const [f] = typeIds.length
  ? await db.select({ n: count() }).from(fields).where(inArray(fields.ticketTypeId, typeIds))
  : [{ n: 0 }];
const [lt] = typeIds.length
  ? await db.select({ n: count() }).from(linkTypes).where(inArray(linkTypes.ticketTypeId, typeIds))
  : [{ n: 0 }];
let statusTotal = 0;
for (const id of typeIds) {
  const [srow] = await db.select({ n: count() }).from(statuses).where(eq(statuses.ticketTypeId, id));
  statusTotal += Number(srow?.n ?? 0);
}
console.log({
  fields: Number(f?.n),
  types: Number(t?.n),
  linkTypes: Number(lt?.n),
  statuses: statusTotal,
});
await sql.end();
