import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, itemValues, items } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';

beforeEach(resetDb);
afterAll(resetDb);

const env = (actorId: number, id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') => ({ commandId: id, actorId });

it('creates an item with values, defaults the workflow field, and emits item.created', async () => {
  const fx = await seedFixture();
  const typeKey = 'task'; // a type the scheme defines with a status field — adjust to the seed
  const result = await runCommand(testDb, itemCreate, env(fx.actorId), {
    projectKey: fx.projectKey,
    typeKey,
    values: { title: 'First' },
  });
  expect(result.number).toBe(1);

  const itemRows = await testDb.select().from(items).where(eq(items.id, result.id));
  expect(itemRows).toHaveLength(1);

  const created = await testDb.select().from(events).where(eq(events.kind, 'item.created'));
  expect(created).toHaveLength(1);
  expect(created[0]!.projectId).toBe(fx.projectId); // item events carry project_id
  expect((created[0]!.payload as { values: Record<string, unknown> }).values.status).toBeDefined();

  const valueRows = await testDb.select().from(itemValues).where(eq(itemValues.itemId, result.id));
  expect(valueRows.length).toBeGreaterThan(0);
});

it('rejects a missing required field', async () => {
  const fx = await seedFixture();
  await expect(
    runCommand(testDb, itemCreate, env(fx.actorId, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), {
      projectKey: fx.projectKey,
      typeKey: 'task',
      values: {}, // no title
    }),
  ).rejects.toThrow(/required/);
});
