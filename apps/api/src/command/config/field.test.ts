import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, fields, itemTypeFields, optionSets } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { fieldCreate } from './field';

beforeEach(resetDb);
afterAll(resetDb);

it('creates a scheme-library field, places it, and emits field.created + field.placed', async () => {
  const fx = await seedFixture();
  const typeId = fx.typeIdByKey.get('task')!;
  const res = await runCommand(testDb, fieldCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemTypeId: typeId, key: 'story_points', label: 'Story Points', type: 'number',
  });
  expect((await testDb.select().from(fields).where(eq(fields.id, res.id)))).toHaveLength(1);
  expect((await testDb.select().from(itemTypeFields).where(eq(itemTypeFields.fieldId, res.id)))).toHaveLength(1);
  const kinds = (await testDb.select().from(events)).map((e) => e.kind);
  expect(kinds).toContain('field.created');
  expect(kinds).toContain('field.placed');
});

it('auto-creates an option set for a new option field with no optionSetId', async () => {
  const fx = await seedFixture();
  const task = fx.typeIdByKey.get('task')!;
  const res = await runCommand(testDb, fieldCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemTypeId: task, key: 'risk', label: 'Risk', type: 'option',
  });
  const field = (await testDb.select().from(fields).where(eq(fields.id, res.id)))[0]!;
  expect(field.optionSetId).not.toBeNull();
  const set = (await testDb.select().from(optionSets).where(eq(optionSets.id, field.optionSetId!)))[0]!;
  expect(set.schemeId).toBe(fx.schemeId);
});
