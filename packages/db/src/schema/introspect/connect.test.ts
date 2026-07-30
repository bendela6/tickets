import { describe, expect, it } from 'vitest';
import { UnknownDatabaseError } from '../list-databases';
import { withDatabase } from './connect';

describe('withDatabase', () => {
  it('runs a query against the named database', async () => {
    const rows = await withDatabase('tickets_test', async (sql) => {
      return sql<{ name: string }[]>`SELECT current_database() AS name`;
    });
    expect(rows[0]?.name).toBe('tickets_test');
  });

  it('refuses an unknown database without connecting', async () => {
    await expect(
      withDatabase('no_such_db', async () => 'unreachable'),
    ).rejects.toBeInstanceOf(UnknownDatabaseError);
  });

  it('closes the connection even when the callback throws', async () => {
    await expect(
      withDatabase('tickets_test', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // A leaked pool would keep the process alive past the suite; a second call
    // succeeding proves the first released cleanly.
    const rows = await withDatabase('tickets_test', async (sql) => sql`SELECT 1 AS ok`);
    expect(rows.length).toBe(1);
  });
});
