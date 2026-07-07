import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { fields, schemes } from '../schema';
import { seedScheme } from './seed-scheme';
import { SOFTWARE_SCHEME } from './software-scheme';

// Ensures the shared Software scheme exists and returns its id plus a
// key→id map of its fields (needed to resolve a project's default view).
export async function ensureSoftwareScheme(
  db: Db,
): Promise<{ schemeId: number; fieldIdByKey: Record<string, number> }> {
  const existing = await db.select().from(schemes).where(eq(schemes.key, SOFTWARE_SCHEME.key));
  if (existing[0]) {
    const fieldRows = await db.select().from(fields).where(eq(fields.schemeId, existing[0].id));
    return {
      schemeId: existing[0].id,
      fieldIdByKey: Object.fromEntries(fieldRows.map((r) => [r.key, r.id])),
    };
  }
  const seeded = await seedScheme(db, SOFTWARE_SCHEME);
  return { schemeId: seeded.schemeId, fieldIdByKey: seeded.fieldIdByKey };
}
