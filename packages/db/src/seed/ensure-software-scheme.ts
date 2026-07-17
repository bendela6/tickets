import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { fields, itemTypes, optionSets, options, schemes } from '../schema';
import type { SeededScheme } from './seed-scheme';
import { seedScheme } from './seed-scheme';
import { softwareScheme } from './software-scheme';

// Ensures the shared Software scheme exists and returns the same id maps
// seedScheme would have produced (types/fields/option sets/options are
// scheme-wide now, not type-owned).
export async function ensureSoftwareScheme(db: Db): Promise<SeededScheme> {
  const existing = await db.select().from(schemes).where(eq(schemes.key, softwareScheme.key));
  if (existing[0]) {
    const schemeId = existing[0].id;
    const typeRows = await db.select().from(itemTypes).where(eq(itemTypes.schemeId, schemeId));
    const fieldRows = await db.select().from(fields).where(eq(fields.schemeId, schemeId));
    const optionSetRows = await db.select().from(optionSets).where(eq(optionSets.schemeId, schemeId));

    const typeIdByKey = new Map(typeRows.map((t) => [t.key, t.id]));
    const fieldIdByKey = new Map(fieldRows.map((f) => [f.key, f.id]));
    const optionSetIdByKey = new Map(optionSetRows.map((s) => [s.key, s.id]));

    const optionIdByKey = new Map<string, number>();
    for (const set of optionSetRows) {
      const optionRows = await db.select().from(options).where(eq(options.optionSetId, set.id));
      for (const o of optionRows) optionIdByKey.set(`${set.key}:${o.value}`, o.id);
    }

    return { schemeId, typeIdByKey, fieldIdByKey, optionSetIdByKey, optionIdByKey };
  }
  return seedScheme(db, softwareScheme);
}
