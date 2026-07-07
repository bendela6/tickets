import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { schemes, ticketTypes } from '../schema';
import { seedScheme } from './seed-scheme';
import { SOFTWARE_SCHEME } from './software-scheme';

// Ensures the shared Software scheme exists and returns its id plus a
// key→id map of its ticket types (fields are now type-owned, not scheme-wide).
export async function ensureSoftwareScheme(
  db: Db,
): Promise<{ schemeId: number; typeIdByKey: Record<string, number> }> {
  const existing = await db.select().from(schemes).where(eq(schemes.key, SOFTWARE_SCHEME.key));
  if (existing[0]) {
    const typeRows = await db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, existing[0].id));
    return {
      schemeId: existing[0].id,
      typeIdByKey: Object.fromEntries(typeRows.map((t) => [t.key, t.id])),
    };
  }
  const seeded = await seedScheme(db, SOFTWARE_SCHEME);
  return { schemeId: seeded.schemeId, typeIdByKey: seeded.typeIdByKey };
}
