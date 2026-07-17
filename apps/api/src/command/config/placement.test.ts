import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, asc, eq } from 'drizzle-orm';
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

// Regression test for the duplicate-position bug: fieldPlace/fieldCreate
// derive `position` from a plain count of the type's placements, but
// unplacing a MIDDLE row used to leave a gap (0,1,3,4 instead of 0,1,2,3)
// with no renumbering and no unique constraint on (itemTypeId, position).
// The next placement then landed at position = count, colliding with the
// row that already sat there — and since the Fields tab's move() swaps by
// *value*, the tie could never be broken through the UI again. Without the
// renumber added to fieldUnplace, this test fails at the
// `toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])` assertion (the gap at 6 survives)
// and/or the final duplicate-position assertion.
it('renumbers the remaining placements to a dense 0..n-1 run after unplacing a middle field, so a later placement never collides', async () => {
  const fx = await seedFixture();
  const bug = fx.typeIdByKey.get('bug')!;
  const labels = fx.fieldIdByKey.get('labels')!; // placed on bug at position 6 in the seed
  const estimate = fx.fieldIdByKey.get('estimate')!; // not placed on bug in the seed

  const before = await testDb.select().from(itemTypeFields).where(eq(itemTypeFields.itemTypeId, bug));
  expect(before).toHaveLength(10);

  await runCommand(testDb, fieldUnplace, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { itemTypeId: bug, fieldId: labels });

  const afterUnplace = await testDb.select().from(itemTypeFields)
    .where(eq(itemTypeFields.itemTypeId, bug)).orderBy(asc(itemTypeFields.position));
  expect(afterUnplace).toHaveLength(9);
  expect(afterUnplace.map((row) => row.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(new Set(afterUnplace.map((row) => row.position)).size).toBe(9);

  await runCommand(testDb, fieldPlace, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { itemTypeId: bug, fieldId: estimate });

  const afterPlace = await testDb.select().from(itemTypeFields).where(eq(itemTypeFields.itemTypeId, bug));
  expect(afterPlace).toHaveLength(10);
  const positions = afterPlace.map((row) => row.position);
  expect(new Set(positions).size).toBe(positions.length);
  const placedRow = afterPlace.find((row) => row.fieldId === estimate)!;
  expect(placedRow.position).toBe(9);
});
