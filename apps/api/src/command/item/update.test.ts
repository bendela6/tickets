import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemUpdate } from './update';

beforeEach(resetDb);
afterAll(resetDb);

async function makeItem(actorId: number, projectKey: string) {
  return runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId }, {
    projectKey, typeKey: 'task', values: { title: 'X' },
  });
}

it('changes a field value and emits item.field_changed with fieldKey (never fieldId)', async () => {
  const fx = await seedFixture();
  const created = await makeItem(fx.actorId, fx.projectKey);
  const res = await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: created.id, expectedUpdatedAt: created.updatedAt, values: { title: 'Y' },
  });
  expect(res.id).toBe(created.id);
  const changed = await testDb.select().from(events).where(eq(events.kind, 'item.field_changed'));
  expect(changed).toHaveLength(1);
  const payload = changed[0]!.payload as Record<string, unknown>;
  expect(payload.fieldKey).toBe('title');
  expect(payload).not.toHaveProperty('fieldId');
});

it('rejects a stale expectedUpdatedAt with 409', async () => {
  const fx = await seedFixture();
  const created = await makeItem(fx.actorId, fx.projectKey);
  await expect(
    runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
      id: created.id, expectedUpdatedAt: '1999-01-01 00:00:00+00', values: { title: 'Z' },
    }),
  ).rejects.toMatchObject({ statusCode: 409 });
});
