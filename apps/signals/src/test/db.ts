import { createDbClient } from '../db/client';
import type { Db } from '../db/client';

if (process.env.SIGNALS_DATABASE !== 'signals_test') {
  throw new Error(
    `signals tests must run against signals_test, not "${process.env.SIGNALS_DATABASE}". ` +
      'Set SIGNALS_DATABASE=signals_test.',
  );
}

const client = createDbClient({ max: 1 });
export const testDb: Db = client.db;

// Child-first so TRUNCATE ... CASCADE resets cleanly.
const TABLES = ['signals', 'sourcemap_artifacts', 'issues', 'apps'];

export async function resetDb(): Promise<void> {
  await client.sql.unsafe(
    `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
