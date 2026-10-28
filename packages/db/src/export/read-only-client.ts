// packages/db/src/export/read-only-client.ts
// The exporter is meant to read production (backing up the live projects
// before they leave the database), so rather than refusing it, it makes
// writing impossible on every connection it opens:
//
//   1. the session starts with default_transaction_read_only=on (a startup
//      parameter, so it holds before the first statement runs), and
//   2. every read runs inside `BEGIN ... READ ONLY` (readOnlySnapshot below),
//   3. which asserts `transaction_read_only` is on before it reads a row.
//
// Postgres itself then rejects any INSERT/UPDATE/DELETE/DDL with
// "cannot execute ... in a read-only transaction" (SQLSTATE 25006).
//
// It also owns the type parsing, so an export holds exactly what the
// database holds:
//   - timestamps stay the raw wire strings (Postgres keeps microseconds, and
//     a JS Date, which postgres.js parses into by default, holds only
//     milliseconds),
//   - int8 (events.id and friends) becomes a JS number, refusing any value a
//     number can't hold exactly, so the JSON needs no BigInt,
//   - numeric stays a string (postgres.js's default; it is exact).
import postgres, { type Sql, type TransactionSql } from 'postgres';
import { connectionUrl } from '../environment';

const rawString = {
  to: 25, // text oid; these overrides only read, serialize is unused but required by the type
  serialize: (x: unknown) => String(x),
  parse: (x: string) => x,
};

const safeInteger = {
  to: 20,
  serialize: (x: unknown) => String(x),
  parse: (x: string) => {
    const n = Number(x);
    if (!Number.isSafeInteger(n))
      throw new Error(`int8 value ${x} does not fit a JS number exactly`);
    return n;
  },
};

// How an export reads each type. The project delete (delete-project.ts) reads
// with the same parsing, so a row it is about to delete compares equal to the
// same row in a backup file.
export const EXPORT_TYPES = {
  timestamptz: { ...rawString, from: [1184] },
  timestamp: { ...rawString, from: [1114] },
  int8: { ...safeInteger, from: [20] },
};

export function createReadOnlyClient(url: string = connectionUrl): { sql: Sql } {
  return {
    sql: postgres(url, {
      max: 1,
      connection: {
        default_transaction_read_only: true,
        application_name: 'tickets-db-export',
      },
      types: EXPORT_TYPES,
    }),
  };
}

export async function assertReadOnly(sql: Sql | TransactionSql): Promise<void> {
  const [row] = await sql<{ transaction_read_only: string }[]>`SHOW transaction_read_only`;
  if (row?.transaction_read_only !== 'on') {
    throw new Error(
      `Refusing to read: transaction_read_only is "${row?.transaction_read_only}", not "on". ` +
        'The exporter only ever reads, and only through a read-only session.',
    );
  }
}

// One consistent snapshot (REPEATABLE READ), read-only twice over.
export async function readOnlySnapshot<T>(
  sql: Sql,
  read: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return (await sql.begin('isolation level repeatable read read only', async (tx) => {
    await assertReadOnly(tx);
    return read(tx);
  })) as T;
}
