import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDbClient } from './client';
import { environment } from './environment';

const { db, sql } = createDbClient({ max: 1 });
const { schema } = environment.postgres;

// search_path points at <schema>, which may not exist yet — create it explicitly
// (schema-qualified, so it works regardless of search_path) before migrating.
await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
await migrate(db, {
  migrationsFolder: resolve(import.meta.dirname, '../drizzle'),
  migrationsSchema: schema,
});
await sql.end();
console.log(`migrations applied to schema "${schema}"`);
