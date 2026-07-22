import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { itemActivity, outbox } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { createOutboxWorker } from './worker';

const captureError = vi.fn();
vi.mock('@bendela6/signals-node', () => ({ getClient: () => ({ captureError }) }));

beforeEach(() => {
  captureError.mockClear();
  return resetDb();
});
afterAll(resetDb);

it('drains pending rows, projects them, and marks done', async () => {
  const fx = await seedFixture();
  const created = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const worker = createOutboxWorker(testDb, { rules: [] }); // no automations for this test
  const processed = await worker.drainOnce();
  expect(processed).toBeGreaterThan(0);
  expect(await testDb.select().from(itemActivity).where(eq(itemActivity.itemId, created.id))).toHaveLength(1);
  const pending = await testDb.select().from(outbox).where(sql`${outbox.doneAt} IS NULL`);
  expect(pending).toHaveLength(0);
});

it('re-processing (done_at reset) does not duplicate the projection', async () => {
  const fx = await seedFixture();
  const created = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const worker = createOutboxWorker(testDb, { rules: [] });
  await worker.drainOnce();
  await testDb.update(outbox).set({ doneAt: null, pickedAt: null });
  await worker.drainOnce();
  expect(await testDb.select().from(itemActivity).where(eq(itemActivity.itemId, created.id))).toHaveLength(1);
});

it('retires a poison event after 5 attempts without blocking', async () => {
  const fx = await seedFixture();
  await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  // a rule that always throws makes every event poison
  const boom = { id: 'boom', on: ['item.created', 'item.field_changed'], when: async () => true, run: async () => { throw new Error('boom'); } };
  const worker = createOutboxWorker(testDb, { rules: [boom] });
  for (let i = 0; i < 6; i++) {
    await testDb.update(outbox).set({ pickedAt: null }); // clear the lease so it is re-claimable each pass
    await worker.drainOnce();
  }
  const rows = await testDb.select().from(outbox);
  // (The illustrative `poison` local from the brief is dropped: outbox rows have no
  // `kind` column, so it does not typecheck. The two expects below are the real assertions.)
  expect(rows.every((r) => r.attempts <= 5)).toBe(true);
  expect(rows.some((r) => r.attempts === 5 && r.doneAt === null && r.lastError !== null)).toBe(true);
});

it('captures a processing failure to Signals (level error, phase drain) without blocking the lastError write', async () => {
  const fx = await seedFixture();
  await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const boom = { id: 'boom', on: ['item.created', 'item.field_changed'], when: async () => true, run: async () => { throw new Error('boom'); } };
  const worker = createOutboxWorker(testDb, { rules: [boom] });
  await worker.drainOnce();

  expect(captureError).toHaveBeenCalledWith(
    expect.any(Error),
    { level: 'error', contexts: { outbox: { phase: 'drain' } } },
  );
  const rows = await testDb.select().from(outbox);
  expect(rows.some((r) => r.lastError !== null)).toBe(true);
});
