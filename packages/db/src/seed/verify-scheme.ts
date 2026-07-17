import { count, eq, inArray } from 'drizzle-orm';
import { createDbClient } from '../client';
import { fields, itemTypeFields, itemTypes, linkTypes, optionSets, optionTransitions } from '../schema';
import { seedScheme } from './seed-scheme';
import { softwareScheme } from './software-scheme';

const { db, sql } = createDbClient({ max: 1 });
const { schemeId, typeIdByKey } = await seedScheme(db, {
  ...softwareScheme,
  key: `software-verify-${Date.now()}`,
});

const typeIds = [...typeIdByKey.values()];
const [t] = await db.select({ n: count() }).from(itemTypes).where(eq(itemTypes.schemeId, schemeId));
const [f] = await db.select({ n: count() }).from(fields).where(eq(fields.schemeId, schemeId));
const [os] = await db.select({ n: count() }).from(optionSets).where(eq(optionSets.schemeId, schemeId));
const [lt] = typeIds.length
  ? await db.select({ n: count() }).from(linkTypes).where(inArray(linkTypes.itemTypeId, typeIds))
  : [{ n: 0 }];
let placementTotal = 0;
for (const id of typeIds) {
  const [row] = await db.select({ n: count() }).from(itemTypeFields).where(eq(itemTypeFields.itemTypeId, id));
  placementTotal += Number(row?.n ?? 0);
}
const [tr] = await db.select({ n: count() }).from(optionTransitions);
console.log({
  types: Number(t?.n),
  fields: Number(f?.n),
  optionSets: Number(os?.n),
  linkTypes: Number(lt?.n),
  placements: placementTotal,
  transitions: Number(tr?.n),
});
await sql.end();
