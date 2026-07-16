import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { comments, optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../../command/run-command';
import { itemCreate } from '../../command/item/create';
import { itemUpdate } from '../../command/item/update';
import { itemLink } from '../../command/item/link';
import { createOutboxWorker } from '../../outbox/worker';
import { blockedLinkFlag } from './blocked-link-flag';

beforeEach(resetDb);
afterAll(resetDb);

it('comments on the blocked target when a resolved blocker reopens', async () => {
  const fx = await seedFixture();
  await testDb.delete(optionTransitions).where(eq(optionTransitions.fieldId, fx.fieldIdByKey.get('status')!));
  const blocker = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Blocker' },
  });
  const target = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Target' },
  });
  await runCommand(testDb, itemLink, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    sourceItemId: blocker.id, targetItemId: target.id, linkTypeKey: 'blocks',
  });
  // resolve then reopen the blocker
  const done = await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: blocker.id, expectedUpdatedAt: blocker.updatedAt, values: { status: 'done' },
  });
  const worker = createOutboxWorker(testDb, { rules: [blockedLinkFlag] });
  await worker.drainOnce();
  await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: blocker.id, expectedUpdatedAt: done.updatedAt, values: { status: 'in-progress' },
  });
  await worker.drainOnce();
  const targetComments = await testDb.select().from(comments).where(eq(comments.itemId, target.id));
  expect(targetComments).toHaveLength(1);
  expect(targetComments[0]!.body).toMatch(/reopened/i);
});
