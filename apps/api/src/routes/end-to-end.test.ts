import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { buildApp } from '../app';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { itemUpdate } from '../command/item/update';
import { createOutboxWorker } from '../outbox/worker';
import { allAutomations } from '../automation/registry';
import '../automation/rules'; // registers all three rules

beforeEach(resetDb);
afterAll(resetDb);

it('all three rules are registered by importing the rules index', () => {
  const ids = allAutomations().map((a) => a.id);
  expect(ids).toEqual(expect.arrayContaining(['parent-rollup', 'auto-assign-on-start', 'blocked-link-flag']));
});

it('end-to-end: resolving the last child rolls the parent up, feed shows it', async () => {
  const fx = await seedFixture();
  await testDb.delete(optionTransitions).where(eq(optionTransitions.fieldId, fx.fieldIdByKey.get('status')!));
  const app = buildApp({ db: testDb });
  const worker = createOutboxWorker(testDb); // default rules = global registry
  const parent = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Parent' },
  });
  const child = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'subtask', parentId: parent.id, values: { title: 'Child' },
  });
  await worker.drainOnce();
  await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: child.id, expectedUpdatedAt: child.updatedAt, values: { status: 'done' },
  });
  await worker.drainOnce();
  // parent-rollup's ctx.dispatch() writes the parent's own item.field_changed event
  // *during* the drain above, after claim() already ran — so it lands in outbox
  // unprocessed. A second drain projects that cascaded event into item_activity.
  await worker.drainOnce();

  const res = await app.inject({ method: 'GET', url: `/api/items/${parent.id}/activity` });
  const kinds = (res.json() as Array<{ kind: string }>).map((e) => e.kind);
  expect(kinds).toContain('item.field_changed'); // the automated parent move is in the feed
  await app.close();
});
