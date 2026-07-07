import { count, eq } from 'drizzle-orm';
import { createDbClient } from '../client';
import { fields, linkTypes, statuses, ticketTypes } from '../schema';
import { seedScheme } from './seed-scheme';
import { SOFTWARE_SCHEME } from './software-scheme';

const { db, sql } = createDbClient({ max: 1 });
const { schemeId, typeIdByKey } = await seedScheme(db, {
  ...SOFTWARE_SCHEME,
  key: `software-verify-${Date.now()}`,
});

const [f] = await db.select({ n: count() }).from(fields).where(eq(fields.schemeId, schemeId));
const [t] = await db.select({ n: count() }).from(ticketTypes).where(eq(ticketTypes.schemeId, schemeId));
const [lt] = await db.select({ n: count() }).from(linkTypes).where(eq(linkTypes.schemeId, schemeId));
let statusTotal = 0;
for (const id of Object.values(typeIdByKey)) {
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
