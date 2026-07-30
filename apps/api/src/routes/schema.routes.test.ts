import { describe, expect, it } from 'vitest';
import { createDbClient } from '@tickets/db';
import { buildApp } from '../app';

// These routes introspect a LIVE database, so unlike the previous
// code-derived route they need postgres actually running. The api suite
// already runs against tickets_test (src/test/setup-env.ts).
describe('GET /api/schema', () => {
  it('returns a live schema graph for the default database', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });
    const res = await app.inject({ method: 'GET', url: '/api/schema' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { tables: unknown[]; groups: unknown[]; enums: unknown[] };
    expect(Array.isArray(body.tables)).toBe(true);
    expect(body.tables.length).toBeGreaterThan(0);
    const items = (body.tables as { name: string; group: string }[]).find((t) => t.name === 'items');
    expect(items?.group).toBe('rc');
    await app.close();
  });

  it('introspects an explicitly named database', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });
    const res = await app.inject({ method: 'GET', url: '/api/schema?database=tickets_test' });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { tables: unknown[] }).tables.length).toBeGreaterThan(0);
    await app.close();
  });

  it('rejects an unknown database with 400', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });
    const res = await app.inject({ method: 'GET', url: '/api/schema?database=no_such_db' });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toContain('no_such_db');
    await app.close();
  });
});

describe('GET /api/schema/databases', () => {
  it('lists databases and names the current one', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });
    const res = await app.inject({ method: 'GET', url: '/api/schema/databases' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { databases: string[]; current: string };
    expect(body.databases).toContain('tickets_test');
    expect(body.current).toBe('tickets_test');
    await app.close();
  });
});
