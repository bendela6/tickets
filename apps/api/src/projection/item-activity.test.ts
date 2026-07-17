import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, itemActivity } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { projectEvent } from './item-activity';

beforeEach(resetDb);
afterAll(resetDb);

it('folds item.created into an activity row and is idempotent', async () => {
  const fx = await seedFixture();
  const created = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Hello' },
  });
  const ev = (await testDb.select().from(events).where(eq(events.kind, 'item.created')))[0]!;

  await projectEvent(testDb, ev);
  await projectEvent(testDb, ev); // second fold must not duplicate

  const rows = await testDb.select().from(itemActivity).where(eq(itemActivity.itemId, created.id));
  expect(rows).toHaveLength(1);
  expect(rows[0]!.kind).toBe('item.created');
  expect(rows[0]!.actorId).toBe(fx.actorId);
  expect(rows[0]!.correlationId).toBe(ev.correlationId);
  const summary = rows[0]!.summary as Record<string, unknown>;
  expect(summary.title).toBe('Hello');
  expect(summary.typeKey).toBe('task');
});

it('ignores non-item and legacy (version 0) events', async () => {
  const fx = await seedFixture();
  await projectEvent(testDb, {
    id: 999999, aggregateType: 'transition', aggregateId: 1, seq: 1, kind: 'transition.created',
    version: 1, payload: {}, actorId: fx.actorId, at: '2026-07-16 00:00:00+00',
    commandId: crypto.randomUUID(), correlationId: crypto.randomUUID(), causedBy: null, depth: 0,
    projectId: null,
  });
  expect(await testDb.select().from(itemActivity)).toHaveLength(0);
});
