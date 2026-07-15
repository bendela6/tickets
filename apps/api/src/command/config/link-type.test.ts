import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, linkTypes } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { linkTypeCreate } from './link-type';

beforeEach(resetDb);
afterAll(resetDb);

it('creates a link type and emits link_type.created', async () => {
  const fx = await seedFixture();
  const typeId = fx.typeIdByKey.get('task')!;
  const res = await runCommand(testDb, linkTypeCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemTypeId: typeId, key: 'relates', label: 'Relates to', inverseLabel: 'Related by', directional: false,
  });
  expect((await testDb.select().from(linkTypes).where(eq(linkTypes.id, res.id)))).toHaveLength(1);
  expect((await testDb.select().from(events).where(eq(events.kind, 'link_type.created')))).toHaveLength(1);
});
