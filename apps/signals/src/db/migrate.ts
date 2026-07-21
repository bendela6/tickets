import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDbClient } from './client';

const { db, sql } = createDbClient({ max: 1 });
await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../drizzle') });
await sql.end();
console.log('signals migrations applied');
