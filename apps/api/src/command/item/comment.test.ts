import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { comments, events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemComment } from './comment';

beforeEach(resetDb);
afterAll(resetDb);

it('adds a comment and emits comment.added', async () => {
  const fx = await seedFixture();
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'X' },
  });
  const res = await runCommand(testDb, itemComment, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemId: item.id, body: 'hello',
  });
  expect((await testDb.select().from(comments).where(eq(comments.id, res.id)))).toHaveLength(1);
  expect((await testDb.select().from(events).where(eq(events.kind, 'comment.added')))).toHaveLength(1);
});
