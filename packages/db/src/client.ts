import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { connectionUrl, environment } from './environment';
import * as schema from './schema';

export function createDbClient({ max = 10 }: { max?: number } = {}) {
  const sql = postgres(connectionUrl, {
    max,
    connection: { options: `-c search_path=${environment.postgres.schema}` },
  });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export type DbClient = ReturnType<typeof createDbClient>;
export type Db = DbClient['db'];
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbExecutor = Db | DbTransaction;
