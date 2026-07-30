import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as connectModule from './connect';
import { UnknownDatabaseError } from '../list-databases';
import { withDatabase } from './connect';

describe('withDatabase', () => {
  let endCallCount: number;

  beforeEach(() => {
    endCallCount = 0;
    (global as any).__withDatabaseEndTracker = () => {
      endCallCount++;
    };
  });

  afterEach(() => {
    delete (global as any).__withDatabaseEndTracker;
  });

  it('runs a query against the named database', async () => {
    const rows = await withDatabase('tickets_test', async (sql) => {
      return sql<{ name: string }[]>`SELECT current_database() AS name`;
    });
    expect(rows[0]?.name).toBe('tickets_test');
    // end() was called on the connection we created
    expect(endCallCount).toBeGreaterThan(0);
  });

  it('refuses an unknown database without connecting', async () => {
    const createSpy = vi.spyOn(connectModule, 'createPostgresInstance');

    await expect(
      withDatabase('no_such_db', async () => 'unreachable'),
    ).rejects.toBeInstanceOf(UnknownDatabaseError);

    // No postgres instance created by withDatabase since validation failed first
    expect(createSpy).not.toHaveBeenCalled();

    createSpy.mockRestore();
  });

  it('closes the connection even when the callback throws', async () => {
    const endCountBefore = endCallCount;

    await expect(
      withDatabase('tickets_test', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // end() must have been called on the first connection despite the error
    expect(endCallCount).toBeGreaterThan(endCountBefore);

    // A second call succeeding proves the first released cleanly
    const rowsBefore = endCallCount;
    const rows = await withDatabase('tickets_test', async (sql) => sql`SELECT 1 AS ok`);
    expect(rows.length).toBe(1);
    expect(endCallCount).toBeGreaterThan(rowsBefore);
  });
});
