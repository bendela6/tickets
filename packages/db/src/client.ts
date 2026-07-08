import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { connectionUrl } from './environment';
import * as schema from './schema';

export function createDbClient({ max = 10 }: { max?: number } = {}) {
  const sql = postgres(connectionUrl, { max });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export type DbClient = ReturnType<typeof createDbClient>;
export type Db = DbClient['db'];
// what a db.transaction callback receives — no $client on it
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];
// accept either the root handle or a transaction handle
export type DbExecutor = Db | DbTransaction;
