import { afterAll, beforeEach, expect, it } from 'vitest';
import * as v from 'valibot';
import { and, eq } from 'drizzle-orm';
import { events, outbox } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { defineEvent, type EventDef } from './registry';
import { writeEvent, type EmitContext } from './write';

beforeEach(resetDb);
afterAll(resetDb);

const probe = defineEvent({
  kind: 'test.probe',
  aggregateType: 'item',
  version: 1,
  payload: v.object({ n: v.number() }),
});

function ctx(actorId: number): EmitContext {
  return {
    envelope: { commandId: '11111111-1111-1111-1111-111111111111', actorId },
    aggregateId: 42,
    projectId: 7,
  };
}

it('writes an events row and a matching outbox row with seq starting at 1', async () => {
  const fx = await seedFixture();
  const id = await testDb.transaction((tx) => writeEvent(tx, ctx(fx.actorId), probe, { n: 5 }));
  const row = (await testDb.select().from(events).where(eq(events.id, id)))[0]!;
  expect(row.seq).toBe(1);
  expect(row.kind).toBe('test.probe');
  expect(row.projectId).toBe(7);
  expect(row.correlationId).toBe('11111111-1111-1111-1111-111111111111'); // defaults to commandId
  const ob = await testDb.select().from(outbox).where(eq(outbox.eventId, id));
  expect(ob).toHaveLength(1);
});

it('increments seq per (aggregateType, aggregateId)', async () => {
  const fx = await seedFixture();
  await testDb.transaction(async (tx) => {
    await writeEvent(tx, ctx(fx.actorId), probe, { n: 1 });
    await writeEvent(tx, ctx(fx.actorId), probe, { n: 2 });
  });
  const rows = await testDb
    .select()
    .from(events)
    .where(and(eq(events.aggregateType, 'item'), eq(events.aggregateId, 42)));
  expect(rows.map((r) => r.seq).sort()).toEqual([1, 2]);
});

it('rejects a payload that fails its schema', async () => {
  const fx = await seedFixture();
  await expect(
    testDb.transaction((tx) => writeEvent(tx, ctx(fx.actorId), probe, { n: 'nope' } as never)),
  ).rejects.toThrow();
});

it('rejects an event object that was never registered', async () => {
  const fx = await seedFixture();
  const rogue = { kind: 'rogue', aggregateType: 'item', version: 1, payload: v.object({}) } as EventDef;
  await expect(
    testDb.transaction((tx) => writeEvent(tx, ctx(fx.actorId), rogue, {})),
  ).rejects.toThrow(/not registered/);
});
