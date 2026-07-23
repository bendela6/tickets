import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { captureSelfError, initSelfSignals } from '../signals-self';
import { createDbClient } from './client';

const { db, sql } = createDbClient({ max: 1 });

try {
  await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../drizzle') });
} catch (err) {
  // Best-effort: register self and report the migration failure before the
  // script exits. If the failing migration is the one that creates the
  // `apps` table itself, self-registration will fail too — that's fine,
  // initSelfSignals never throws and captureSelfError is a no-op without a
  // client. Either way the original error still propagates below.
  const client = await initSelfSignals(db);
  captureSelfError(err);
  await Promise.race([client?.flush() ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2000))]).catch(
    () => undefined,
  );
  await sql.end().catch(() => undefined);
  throw err;
}

await sql.end();
console.log('signals migrations applied');
