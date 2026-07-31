import { describe, expect, it, vi } from 'vitest';
import { createPostgresInstance, withDatabase } from './connect';
import { UnknownDatabaseError } from '../list-databases';

describe('withDatabase', () => {
  it('runs a query against the named database', async () => {
    const endCalls: any[] = [];

    const wrappedFactory = (options: any) => {
      const instance = createPostgresInstance(options);
      const originalEnd = instance.end.bind(instance);
      instance.end = vi.fn(async (...args: any[]) => {
        endCalls.push({ args });
        return originalEnd(...args);
      });
      return instance;
    };

    const rows = await withDatabase(
      'tickets_test',
      async (sql) => {
        return sql<{ name: string }[]>`SELECT current_database() AS name`;
      },
      wrappedFactory,
    );
    expect(rows[0]?.name).toBe('tickets_test');
    // end() was called on the connection we created
    expect(endCalls.length).toBeGreaterThan(0);
  });

  it('refuses an unknown database without connecting', async () => {
    const createSpy = vi.fn().mockImplementation(createPostgresInstance);

    await expect(
      withDatabase(
        'no_such_db',
        async () => 'unreachable',
        createSpy,
      ),
    ).rejects.toBeInstanceOf(UnknownDatabaseError);

    // No postgres instance created by withDatabase since validation failed first
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('closes the connection even when the callback throws', async () => {
    const endCalls: any[] = [];

    const wrappedFactory = (options: any) => {
      const instance = createPostgresInstance(options);
      const originalEnd = instance.end.bind(instance);
      instance.end = vi.fn(async (...args: any[]) => {
        endCalls.push({ args });
        return originalEnd(...args);
      });
      return instance;
    };

    await expect(
      withDatabase(
        'tickets_test',
        async () => {
          throw new Error('boom');
        },
        wrappedFactory,
      ),
    ).rejects.toThrow('boom');

    // end() must have been called on the first connection despite the error
    expect(endCalls.length).toBeGreaterThan(0);

    // A second call succeeding proves the first released cleanly
    const rows = await withDatabase('tickets_test', async (sql) => sql`SELECT 1 AS ok`);
    expect(rows.length).toBe(1);
  });
});
