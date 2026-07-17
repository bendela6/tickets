import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, itemLinks } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemLink, itemUnlink } from './link';

beforeEach(resetDb);
afterAll(resetDb);

it('links two items and unlinks, emitting item.linked / item.unlinked on the source stream', async () => {
  const fx = await seedFixture();
  const a = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const b = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'B' },
  });
  const linkTypeKey = 'blocks'; // task type owns this link type in the seed
  const link = await runCommand(testDb, itemLink, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    sourceItemId: a.id, targetItemId: b.id, linkTypeKey,
  });
  expect((await testDb.select().from(itemLinks).where(eq(itemLinks.id, link.id)))).toHaveLength(1);
  expect((await testDb.select().from(events).where(eq(events.kind, 'item.linked')))).toHaveLength(1);

  await runCommand(testDb, itemUnlink, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { id: link.id });
  expect((await testDb.select().from(itemLinks).where(eq(itemLinks.id, link.id)))).toHaveLength(0);
  expect((await testDb.select().from(events).where(eq(events.kind, 'item.unlinked')))).toHaveLength(1);
});

it('rejects linking with a link-type key the source type does not own', async () => {
  const fx = await seedFixture();
  const a = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const b = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'B' },
  });
  await expect(
    runCommand(testDb, itemLink, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
      sourceItemId: a.id, targetItemId: b.id, linkTypeKey: 'no-such-link',
    }),
  ).rejects.toMatchObject({ statusCode: 400 });
});

it('rejects linking when the target item type is not in the link type\'s allowed targets', async () => {
  const fx = await seedFixture();
  // "duplicates" is owned by task and only targets ['task', 'bug'] in the seed (packages/db/src/seed/software-scheme.ts) — epic is excluded.
  const task = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Task' },
  });
  const epic = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'epic', values: { title: 'Epic' },
  });
  await expect(
    runCommand(testDb, itemLink, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
      sourceItemId: task.id, targetItemId: epic.id, linkTypeKey: 'duplicates',
    }),
  ).rejects.toMatchObject({ statusCode: 422 });
});
