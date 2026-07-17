import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemUpdate } from './update';

beforeEach(resetDb);
afterAll(resetDb);

it('setting a field to its current value emits no field_changed', async () => {
  const fx = await seedFixture();
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Same' },
  });
  await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: item.id, expectedUpdatedAt: item.updatedAt, values: { title: 'Same' },
  });
  const changed = await testDb.select().from(events).where(eq(events.kind, 'item.field_changed'));
  expect(changed).toHaveLength(0);
});
