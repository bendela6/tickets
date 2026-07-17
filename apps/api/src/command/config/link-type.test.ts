import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, linkTypeTargetTypes, linkTypes } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../run-command';
import { linkTypeCreate, linkTypeSetTargetTypes, linkTypeUpdate } from './link-type';

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

it('updates a link type label + archives it', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const blocks = [...vocab.linkTypeByTypeKey.values()].find((lt) => lt.key === 'blocks')!;
  await runCommand(testDb, linkTypeUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { id: blocks.id, label: 'Blocks (hard)', archived: true });
  const row = (await testDb.select().from(linkTypes).where(eq(linkTypes.id, blocks.id)))[0]!;
  expect(row.label).toBe('Blocks (hard)');
  expect(row.archivedAt).not.toBeNull();
  expect((await testDb.select().from(events).where(eq(events.kind, 'link_type.updated')))).toHaveLength(1);
});

it('replaces target types', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const blocks = [...vocab.linkTypeByTypeKey.values()].find((lt) => lt.key === 'blocks')!;
  const task = fx.typeIdByKey.get('task')!;
  await runCommand(testDb, linkTypeSetTargetTypes, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { linkTypeId: blocks.id, targetTypeIds: [task] });
  const rows = await testDb.select().from(linkTypeTargetTypes).where(eq(linkTypeTargetTypes.linkTypeId, blocks.id));
  expect(rows.map((r) => r.targetTypeId)).toEqual([task]);
  expect((await testDb.select().from(events).where(eq(events.kind, 'link_type.target_types_set')))).toHaveLength(1);
});
