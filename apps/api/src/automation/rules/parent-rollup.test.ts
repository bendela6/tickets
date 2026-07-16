import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { events, itemValues, optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../../command/run-command';
import { itemCreate } from '../../command/item/create';
import { itemUpdate } from '../../command/item/update';
import { createOutboxWorker } from '../../outbox/worker';
import { parentRollup } from './parent-rollup';

beforeEach(resetDb);
afterAll(resetDb);

it('marks the parent done when its last child resolves', async () => {
  const fx = await seedFixture();
  // make status freely movable (seed installs entry-only edges)
  await testDb.delete(optionTransitions).where(eq(optionTransitions.fieldId, fx.fieldIdByKey.get('status')!));

  const parent = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Parent' },
  });
  const child = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'subtask', parentId: parent.id, values: { title: 'Child' },
  });
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  await worker.drainOnce(); // fold the create events

  const moved = await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: child.id, expectedUpdatedAt: child.updatedAt, values: { status: 'done' },
  });
  expect(moved.id).toBe(child.id);
  await worker.drainOnce(); // triggers the rollup

  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const statusFieldId = fx.fieldIdByKey.get('status')!;
  const parentStatusRows = await testDb
    .select()
    .from(itemValues)
    .where(and(eq(itemValues.itemId, parent.id), eq(itemValues.fieldId, statusFieldId)));
  const optId = parentStatusRows[0]!.optionId!;
  expect(vocab.optionById.get(optId)!.kind).toBe('done');

  // the parent update was a chained automation command
  const parentDone = (await testDb.select().from(events)
    .where(and(eq(events.aggregateId, parent.id), eq(events.kind, 'item.field_changed')))).at(-1)!;
  expect(parentDone.depth).toBe(1);
});
