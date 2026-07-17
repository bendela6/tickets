import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { commands, events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { itemComment } from '../command/item/comment';
import type { AutomationDef } from './registry';
import { runAutomations } from './run-automations';

beforeEach(resetDb);
afterAll(resetDb);

// A throwaway rule (passed explicitly — never globally registered) that comments
// on the item whenever it is created.
const commentRule: AutomationDef = {
  id: 'test-comment-on-create',
  on: ['item.created'],
  when: async () => true,
  run: async (event, ctx) => {
    await ctx.dispatch(itemComment, { itemId: event.aggregateId, body: 'auto' }, 'c');
  },
};

it('dispatches a chained command with caused_by/correlation/depth and is idempotent', async () => {
  const fx = await seedFixture();
  const created = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const createdEvent = (await testDb.select().from(events).where(eq(events.kind, 'item.created')))[0]!;

  await runAutomations(testDb, createdEvent, { systemActorId: fx.actorId, rules: [commentRule] });
  await runAutomations(testDb, createdEvent, { systemActorId: fx.actorId, rules: [commentRule] }); // re-run: no-op

  const commentEvents = await testDb.select().from(events).where(eq(events.kind, 'comment.added'));
  expect(commentEvents).toHaveLength(1); // deterministic commandId ⇒ ledger dedupe
  expect(commentEvents[0]!.causedBy).toBe(createdEvent.id);
  expect(commentEvents[0]!.correlationId).toBe(createdEvent.correlationId);
  expect(commentEvents[0]!.depth).toBe(createdEvent.depth + 1);
  // exactly one ledger row for the derived commandId
  expect(await testDb.select().from(commands).where(eq(commands.aggregateType, 'item'))).toHaveLength(2); // create + comment
});
