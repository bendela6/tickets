import postgres from 'postgres';
import { environment } from '../../environment';
import { assertKnownDatabase } from '../list-databases';

/**
 * For testing: factory for postgres instances. Wraps each instance to track
 * end() calls for leak detection in tests.
 */
export function createPostgresInstance(options: Parameters<typeof postgres>[0]) {
  const sql = postgres(options);
  // Wrap end() to enable test tracking if a hook is installed
  if (typeof (global as any).__withDatabaseEndTracker === 'function') {
    const originalEnd = sql.end.bind(sql);
    sql.end = (async (...args: any[]) => {
      (global as any).__withDatabaseEndTracker();
      return originalEnd(...args);
    }) as any;
  }
  return sql;
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
 */
export async function withDatabase<T>(
  name: string,
  fn: (sql: postgres.Sql) => Promise<T>,
): Promise<T> {
  const database = await assertKnownDatabase(name);
  const { host, port, user, password } = environment.postgres;
  const sql = createPostgresInstance({ host, port, user, password, database, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
