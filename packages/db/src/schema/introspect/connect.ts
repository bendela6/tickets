import postgres from 'postgres';
import { environment } from '../../environment';
import { assertKnownDatabase } from '../list-databases';

export function createPostgresInstance(options: postgres.Options<Record<string, never>>) {
  return postgres(options);
}

/**
 * Open a short-lived, read-only connection to a NAMED database and hand the
 * caller the raw postgres.js handle.
 *
 * Only the database name varies — host, port, user and password always come
 * from `environment.postgres`, so no caller can redirect this at another
 * server. The name is validated against the live `pg_database` enumeration
 * BEFORE a connection is attempted (assertKnownDatabase), which is what keeps
 * a caller string from ever reaching a connection URL unchecked.
 *
 * `max: 1` plus an unconditional close in `finally`: introspection runs once
 * per dropdown change, so a pool cached per database would hold idle handles
 * open against every database anyone ever looked at.
 *
 * @param name - database name, validated via assertKnownDatabase
 * @param fn - callback receiving the postgres.Sql handle
 * @param createClient - optional factory for postgres instances (for testing);
 *                       defaults to createPostgresInstance
 */
export async function withDatabase<T>(
  name: string,
  fn: (sql: postgres.Sql) => Promise<T>,
  createClient?: typeof createPostgresInstance,
): Promise<T> {
  const database = await assertKnownDatabase(name);
  const { host, port, user, password } = environment.postgres;
  const factory = createClient || createPostgresInstance;
  const sql = factory({ host, port, user, password, database, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
