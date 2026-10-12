import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { itemTypeFields, itemValues, options } from '@tickets/db';
import { resetDb, seedPlanFixture, testDb, type Fixture } from '../../test/db';
import { runCommand } from '../run-command';
import { optionCreate } from '../config/option';
import { itemCreate } from './create';
import { itemUpdate } from './update';

beforeEach(resetDb);
afterAll(resetDb);

const WHERE = [{ repo: 'tickets', part: 'apps/api' }];

function envelope(fx: Fixture) {
  return { commandId: crypto.randomUUID(), actorId: fx.actorId };
}

async function makeFeature(fx: Fixture, values: Record<string, unknown> = {}) {
  return runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey: 'feature', values: { title: 'Add a thing', where: WHERE, ...values },
  });
}

async function setStatus(fx: Fixture, item: { id: number; updatedAt?: string }, status: string) {
  return runCommand(testDb, itemUpdate, envelope(fx), {
    id: item.id, expectedUpdatedAt: item.updatedAt!, values: { status },
  });
}

async function restore(fx: Fixture, item: { id: number; updatedAt?: string }) {
  return runCommand(testDb, itemUpdate, envelope(fx), {
    id: item.id, expectedUpdatedAt: item.updatedAt!, restoreStatus: true,
  });
}

async function statusOf(fx: Fixture, itemId: number): Promise<string | undefined> {
  const rows = await testDb
    .select({ value: options.value })
    .from(itemValues)
    .innerJoin(options, eq(options.id, itemValues.optionId))
    .where(and(eq(itemValues.itemId, itemId), eq(itemValues.fieldId, fx.fieldIdByKey.get('status')!)));
  return rows[0]?.value;
}

it('returns a cancelled feature to the status it had before it was cancelled', async () => {
  const fx = await seedPlanFixture();
  const feature = await makeFeature(fx);
  const planned = await setStatus(fx, feature, 'planned');
  const cancelled = await setStatus(fx, planned, 'cancelled');
  expect(await statusOf(fx, feature.id)).toBe('cancelled');

  await restore(fx, cancelled);
  expect(await statusOf(fx, feature.id)).toBe('planned');
});

it('returns a ticket cancelled after it was done to Done', async () => {
  const fx = await seedPlanFixture();
  const feature = await makeFeature(fx);
  const ticket = await runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey: 'ticket', parentId: feature.id, values: { title: 'Add a part' },
  });
  expect(await statusOf(fx, ticket.id)).toBe('todo');
  const done = await setStatus(fx, ticket, 'done');
  const cancelled = await setStatus(fx, done, 'cancelled');
  await restore(fx, cancelled);
  expect(await statusOf(fx, ticket.id)).toBe('done');
});

it('walks back past a move from one dropped status to another', async () => {
  const fx = await seedPlanFixture();
  const statusFieldId = fx.fieldIdByKey.get('status')!;
  const superseded = await runCommand(testDb, optionCreate, envelope(fx), {
    fieldId: statusFieldId, value: 'superseded', label: 'Superseded', kind: 'dropped',
  });
  // let a feature use it: add it to the feature's status allowlist
  const featureTypeId = fx.typeIdByKey.get('feature')!;
  const [placement] = await testDb.select().from(itemTypeFields)
    .where(and(eq(itemTypeFields.itemTypeId, featureTypeId), eq(itemTypeFields.fieldId, statusFieldId)));
  const allowed = (placement!.configOverride as { allowedOptionIds: number[] }).allowedOptionIds;
  await testDb.update(itemTypeFields)
    .set({ configOverride: { allowedOptionIds: [...allowed, superseded.id] } })
    .where(and(eq(itemTypeFields.itemTypeId, featureTypeId), eq(itemTypeFields.fieldId, statusFieldId)));

  const feature = await makeFeature(fx);
  const designed = await setStatus(fx, feature, 'designed');
  const cancelled = await setStatus(fx, designed, 'cancelled');
  const moved = await setStatus(fx, cancelled, 'superseded');
  await restore(fx, moved);
  expect(await statusOf(fx, feature.id)).toBe('designed');
});

it('returns an item made cancelled to its type\'s first status', async () => {
  const fx = await seedPlanFixture();
  const feature = await makeFeature(fx, { status: 'cancelled' });
  await restore(fx, feature);
  expect(await statusOf(fx, feature.id)).toBe('not-planned');
});

it('refuses to restore an item that is not cancelled', async () => {
  const fx = await seedPlanFixture();
  const feature = await makeFeature(fx);
  const planned = await setStatus(fx, feature, 'planned');
  await expect(restore(fx, planned)).rejects.toMatchObject({
    statusCode: 422,
    message: expect.stringContaining('only a cancelled item can be restored'),
  });
  expect(await statusOf(fx, feature.id)).toBe('planned');
});

it('refuses restoreStatus beside a status of its own', async () => {
  const fx = await seedPlanFixture();
  const feature = await makeFeature(fx, { status: 'cancelled' });
  await expect(
    runCommand(testDb, itemUpdate, envelope(fx), {
      id: feature.id, expectedUpdatedAt: feature.updatedAt, restoreStatus: true, values: { status: 'planned' },
    }),
  ).rejects.toMatchObject({ statusCode: 400 });
});
