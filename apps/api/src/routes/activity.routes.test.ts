import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { buildApp } from '../app';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { projectEvent } from '../projection/item-activity';

beforeEach(resetDb);
afterAll(resetDb);

it('GET /api/items/:id/activity returns folded entries in order', async () => {
  const fx = await seedFixture();
  const created = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  for (const ev of await testDb.select().from(events).where(eq(events.aggregateId, created.id))) {
    await projectEvent(testDb, ev);
  }
  const app = buildApp({ db: testDb });
  const res = await app.inject({ method: 'GET', url: `/api/items/${created.id}/activity` });
  expect(res.statusCode).toBe(200);
  const body = res.json() as Array<{ kind: string; summary: Record<string, unknown> }>;
  expect(body[0]!.kind).toBe('item.created');
  expect(body[0]!.summary.title).toBe('A');
  await app.close();
});
