import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { events, itemTypeFields } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { fieldPlace, fieldUnplace, placementUpdate } from './placement';

beforeEach(resetDb);
afterAll(resetDb);

it('places an existing library field on a type and rejects a duplicate', async () => {
  const fx = await seedFixture();
  const bug = fx.typeIdByKey.get('bug')!;
  const estimate = fx.fieldIdByKey.get('estimate')!; // library field not placed on bug in the seed
  await runCommand(testDb, fieldPlace, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { itemTypeId: bug, fieldId: estimate, required: false });
  const rows = await testDb.select().from(itemTypeFields).where(and(eq(itemTypeFields.itemTypeId, bug), eq(itemTypeFields.fieldId, estimate)));
  expect(rows).toHaveLength(1);
  expect((await testDb.select().from(events).where(eq(events.kind, 'field.placed')))).toHaveLength(1);
  await expect(
    runCommand(testDb, fieldPlace, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { itemTypeId: bug, fieldId: estimate }),
  ).rejects.toMatchObject({ statusCode: 422 });
});

it('unplaces a field from a type (leaving the library field intact) and emits field.unplaced', async () => {
  const fx = await seedFixture();
  const task = fx.typeIdByKey.get('task')!;
  const estimate = fx.fieldIdByKey.get('estimate')!; // seed places estimate on task
  await runCommand(testDb, fieldUnplace, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { itemTypeId: task, fieldId: estimate });
  const rows = await testDb.select().from(itemTypeFields).where(and(eq(itemTypeFields.itemTypeId, task), eq(itemTypeFields.fieldId, estimate)));
  expect(rows).toHaveLength(0);
  expect((await testDb.select().from(events).where(eq(events.kind, 'field.unplaced')))).toHaveLength(1);
});

it('updates required + the per-type option allowlist', async () => {
  const fx = await seedFixture();
  const task = fx.typeIdByKey.get('task')!;
  const priority = fx.fieldIdByKey.get('priority')!; // placed on task in the seed
  const urgent = fx.optionIdByKey.get('priority:urgent')!;
  const high = fx.optionIdByKey.get('priority:high')!;
  await runCommand(testDb, placementUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemTypeId: task, fieldId: priority, required: true, allowedOptionIds: [urgent, high],
  });
  const row = (await testDb.select().from(itemTypeFields).where(and(eq(itemTypeFields.itemTypeId, task), eq(itemTypeFields.fieldId, priority))))[0]!;
  expect(row.required).toBe(true);
  expect((row.configOverride as { allowedOptionIds?: number[] }).allowedOptionIds!.sort()).toEqual([urgent, high].sort());
  expect((await testDb.select().from(events).where(eq(events.kind, 'placement.updated')))).toHaveLength(1);
});
