import { describe, expect, it } from 'vitest';
import { createDbClient } from '@tickets/db';
import { buildApp } from '../app';

// describeSchema() introspects the drizzle table objects and never touches
// the database, so a lazily-connecting client (no live postgres required) is
// enough to build the app and drive this route via app.inject — same
// mechanism app.test.ts uses, just without the scratch-db setup that other
// route tests need because their handlers actually read/write data.
describe('GET /api/schema', () => {
  it('returns the schema graph', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });
    const res = await app.inject({ method: 'GET', url: '/api/schema' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { tables: unknown[]; groups: unknown[] };
    expect(Array.isArray(body.tables)).toBe(true);
    expect(body.tables.length).toBeGreaterThan(0);
    const tickets = (body.tables as { name: string; group: string }[]).find(
      (t) => t.name === 'tickets',
    );
    expect(tickets?.group).toBe('records');
    await app.close();
  });
});
