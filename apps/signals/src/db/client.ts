import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { connectionUrl } from '../environment';
import * as schema from './schema';

export function createDbClient({ max = 10 }: { max?: number } = {}) {
  const sql = postgres(connectionUrl, { max });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export type DbClient = ReturnType<typeof createDbClient>;
export type Db = DbClient['db'];

// The type of the `tx` handed to a `db.transaction(async (tx) => ...)` callback.
// Structurally different from `Db` (no `$client`), but shares every query-builder
// method — helpers that must work both standalone and inside a caller's
// transaction (e.g. issue-prune.ts) should accept `Db | Tx`.
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
