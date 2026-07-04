import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { users } from '../schema';

export async function ensureUser(
  db: Db,
  input: { name: string; kind: 'human' | 'agent' },
): Promise<number> {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.name, input.name));
  if (existing[0]) {
    return existing[0].id;
  }
  const inserted = await db
    .insert(users)
    .values({ name: input.name, kind: input.kind })
    .returning({ id: users.id });
  if (!inserted[0]) {
    throw new Error(`could not create user "${input.name}"`);
  }
  return inserted[0].id;
}
