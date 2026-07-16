import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { itemValues, optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../../command/run-command';
import { itemCreate } from '../../command/item/create';
import { itemUpdate } from '../../command/item/update';
import { createOutboxWorker } from '../../outbox/worker';
import { autoAssignOnStart } from './auto-assign-on-start';

beforeEach(resetDb);
afterAll(resetDb);

it('assigns the actor when an unassigned item starts', async () => {
  const fx = await seedFixture();
  await testDb.delete(optionTransitions).where(eq(optionTransitions.fieldId, fx.fieldIdByKey.get('status')!));
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const worker = createOutboxWorker(testDb, { rules: [autoAssignOnStart] });
  await worker.drainOnce();
  await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: item.id, expectedUpdatedAt: item.updatedAt, values: { status: 'in-progress' },
  });
  await worker.drainOnce();
  const assigneeRows = await testDb.select().from(itemValues)
    .where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, fx.fieldIdByKey.get('assignee')!)));
  expect(assigneeRows[0]!.valueUserId).toBe(fx.actorId);
});
