import postgres from 'postgres';
import { environment } from '../environment';

/**
 * A database name the caller asked for that is not on this server. Carries the
 * name so the route can put it in a 400 body without re-deriving it.
 */
export class UnknownDatabaseError extends Error {
  constructor(readonly database: string) {
    super(`unknown database "${database}"`);
    this.name = 'UnknownDatabaseError';
  }
}

// Catalog reads connect to a database that is guaranteed to exist and to be
// connectable — the configured one — and ask it about its siblings. `max: 1`
// and an immediate close keep this from holding a pool open between requests.
async function withAdminConnection<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const { host, port, user, password, database } = environment.postgres;
  const sql = postgres({ host, port, user, password, database, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Non-template, connectable databases on the configured server, sorted. */
export async function listDatabases(): Promise<string[]> {
  return withAdminConnection(async (sql) => {
    const rows = await sql<{ datname: string }[]>`
      SELECT datname
      FROM pg_database
      WHERE NOT datistemplate AND datallowconn
      ORDER BY datname
    `;
    return rows.map((r) => r.datname);
  });
}

/**
 * The ONLY sanctioned path from a caller-supplied string to a database name.
 * Membership in the live enumeration is the whole check — a name that is not
 * on the server can never reach a connection URL, so no escaping or pattern
 * matching is needed or attempted.
 */
export async function assertKnownDatabase(name: string): Promise<string> {
  const names = await listDatabases();
  if (!names.includes(name)) throw new UnknownDatabaseError(name);
  return name;
}
