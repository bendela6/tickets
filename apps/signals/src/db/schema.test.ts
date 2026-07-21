import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, testDb } from '../test/db';
import { apps, issues, signals } from './schema';

beforeEach(resetDb);
afterAll(resetDb);

it('inserts an app, an issue, and a signal referencing both', async () => {
  const [appRow] = await testDb
    .insert(apps)
    .values({ name: 'Storefront', slug: 'storefront-web', ingestKey: 'pub_0123456789ab' })
    .returning();
  const [issueRow] = await testDb
    .insert(issues)
    .values({ appId: appRow!.id, fingerprint: 'fp1', title: 'TypeError — boom' })
    .returning();
  const [signalRow] = await testDb
    .insert(signals)
    .values({
      appId: appRow!.id,
      kind: 'error',
      sessionId: 'sess_1',
      name: 'TypeError',
      message: 'boom',
      mechanism: 'manual',
      level: 'error',
      clientTimestamp: new Date(),
      issueId: issueRow!.id,
      payload: { platform: { runtime: 'node' }, sdk: { name: 'test', version: '0.0.0' } },
    })
    .returning();
  expect(signalRow!.issueId).toBe(issueRow!.id);
  expect(issueRow!.status).toBe('open');
  expect(issueRow!.eventCount).toBe(1);
});
