import { describe, expect, it } from 'vitest';
import { createDbClient, environment } from '@tickets/db';
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

  it('honors ?database= — a different database returns a genuinely different table set', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });

    // `postgres` is the maintenance database every Postgres server ships —
    // always present, always connectable, and it holds none of the tickets
    // tables. Using it as the discriminator (rather than tickets_test twice)
    // means the two halves below can only both pass if the ?database= value
    // actually reaches introspectDatabase.
    const other = await app.inject({ method: 'GET', url: '/api/schema?database=postgres' });
    expect(other.statusCode).toBe(200);
    const otherTables = (other.json() as { tables: { name: string }[] }).tables;
    expect(otherTables.some((t) => t.name === 'items')).toBe(false);

    const mine = await app.inject({ method: 'GET', url: '/api/schema' });
    expect(mine.statusCode).toBe(200);
    const mineTables = (mine.json() as { tables: { name: string }[] }).tables;
    expect(mineTables.some((t) => t.name === 'items')).toBe(true);

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
    // Documents intent (current should track the configured database) rather
    // than defeating a hardcode: environment.postgres.database IS
    // 'tickets_test' in this test env, so a literal would still pass this.
    // See task-9 mutation-testing report for why that gap is accepted as-is.
    expect(body.current).toBe(environment.postgres.database);
    await app.close();
  });
});
