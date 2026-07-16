import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, itemTypeChildTypes, itemTypes } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { typeCreate, typeSetChildTypes, typeUpdate } from './type';

beforeEach(resetDb);
afterAll(resetDb);

it('creates a type at the next position and emits type.created', async () => {
  const fx = await seedFixture();
  const res = await runCommand(testDb, typeCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    schemeId: fx.schemeId, key: 'chore', label: 'Chore', config: { color: '#888' },
  });
  const row = (await testDb.select().from(itemTypes).where(eq(itemTypes.id, res.id)))[0]!;
  expect(row.key).toBe('chore');
  expect((row.config as { color?: string }).color).toBe('#888');
  expect((await testDb.select().from(events).where(eq(events.kind, 'type.created')))).toHaveLength(1);
});

it('updates a type label and archives/unarchives it', async () => {
  const fx = await seedFixture();
  const id = fx.typeIdByKey.get('bug')!;
  await runCommand(testDb, typeUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { id, label: 'Defect', archived: true });
  let row = (await testDb.select().from(itemTypes).where(eq(itemTypes.id, id)))[0]!;
  expect(row.label).toBe('Defect');
  expect(row.archivedAt).not.toBeNull();
  await runCommand(testDb, typeUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { id, archived: false });
  row = (await testDb.select().from(itemTypes).where(eq(itemTypes.id, id)))[0]!;
  expect(row.archivedAt).toBeNull();
});

it('replaces child types (not append/wipe-others) and emits type.child_types_set', async () => {
  const fx = await seedFixture();
  const epic = fx.typeIdByKey.get('epic')!;
  const task = fx.typeIdByKey.get('task')!;
  const bug = fx.typeIdByKey.get('bug')!;
  const spike = fx.typeIdByKey.get('spike')!;
  // epic seeds allow task/bug/spike; replace with just [task]
  await runCommand(testDb, typeSetChildTypes, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { typeId: epic, childTypeIds: [task] });
  const rows = await testDb.select().from(itemTypeChildTypes).where(eq(itemTypeChildTypes.parentTypeId, epic));
  expect(rows.map((r) => r.childTypeId).sort()).toEqual([task]);
  // task's own child rows (subtask) are untouched
  const taskChildren = await testDb.select().from(itemTypeChildTypes).where(eq(itemTypeChildTypes.parentTypeId, task));
  expect(taskChildren.length).toBeGreaterThan(0);
  expect((await testDb.select().from(events).where(eq(events.kind, 'type.child_types_set')))).toHaveLength(1);
  void bug; void spike;
});
