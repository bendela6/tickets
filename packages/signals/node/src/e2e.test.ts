import { describe, expect, it } from 'vitest';
import { initSignals } from './index';

// End-to-end: real HTTP from the node SDK into the real collector (in-process,
// signals_test database). Skips only when the collector sources can't be
// resolved (e.g. running this package outside the monorepo). If postgres
// itself is down, this test does NOT skip — createDbClient/sql.unsafe below
// will throw and the test FAILS, intentionally: a down collector DB is a real
// problem this suite should surface, not silently swallow.
describe('node SDK ⇄ collector e2e', () => {
  it('captureError lands as a grouped issue', async () => {
    process.env.SIGNALS_DATABASE = 'signals_test';
    let buildApp, createDbClient;
    try {
      // dev-only cross-package import: pulls collector sources into the node SDK's
      // test run so the e2e test can spin up the real app in-process. Not part of
      // the published package (see src/index.ts) — test-time only.
      ({ buildApp } = await import('../../../../apps/signals/src/app'));
      ({ createDbClient } = await import('../../../../apps/signals/src/db/client'));
    } catch {
      return; /* collector sources unavailable — skip */
    }
    const { db, sql } = createDbClient({ max: 1 });
    await sql.unsafe('TRUNCATE "signals", "sourcemap_artifacts", "issues", "apps" RESTART IDENTITY CASCADE');
    const app = buildApp({ db });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const port = (app.server.address() as { port: number }).port;
    const created = await fetch(`http://127.0.0.1:${port}/apps`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'E2E' }),
    }).then((r) => r.json() as Promise<{ id: number; ingestKey: string }>);

    const client = initSignals({
      dsn: `sgl://${created.ingestKey}@127.0.0.1:${port}/${created.id}`,
      registerProcessHandlers: false,
      release: '1.0.0',
    });
    client.captureError(new TypeError('e2e boom'));
    await client.flush();

    const issues = await fetch(`http://127.0.0.1:${port}/issues`)
      .then((r) => r.json() as Promise<{ total: number; rows: Array<{ title: string; key: string }> }>);
    expect(issues.total).toBe(1);
    expect(issues.rows[0]!.title).toContain('e2e boom');
    expect(issues.rows[0]!.key).toMatch(/^SGL-\d+$/);
    await app.close();
    await sql.end();
  }, 30_000);
});
