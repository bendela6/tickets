import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemAgentDispatched } from './agent-dispatched';

beforeEach(resetDb);
afterAll(resetDb);

it('emits item.agent_dispatched carrying the session and agent ids', async () => {
  const fx = await seedFixture();
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'X' },
  });
  await runCommand(
    testDb,
    itemAgentDispatched,
    { commandId: crypto.randomUUID(), actorId: fx.actorId },
    { itemId: item.id, sessionId: 42, agentId: 7 },
  );
  const rows = await testDb.select().from(events).where(eq(events.kind, 'item.agent_dispatched'));
  expect(rows).toHaveLength(1);
  expect(rows[0]!.payload).toEqual({ sessionId: 42, agentId: 7 });
});

it('404s when the item does not exist', async () => {
  const fx = await seedFixture();
  await expect(
    runCommand(
      testDb,
      itemAgentDispatched,
      { commandId: crypto.randomUUID(), actorId: fx.actorId },
      { itemId: 999_999, sessionId: 1, agentId: 1 },
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
});
