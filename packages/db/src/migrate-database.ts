import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDbClient } from './client';

// Applies every migration in drizzle/ that the database POSTGRES_DATABASE names hasn't run yet.
export async function migrateDatabase(): Promise<void> {
  const { db, sql } = createDbClient({ max: 1 });
  try {
    await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../drizzle') });
  } finally {
    await sql.end();
  }
}
