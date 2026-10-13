import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { events, itemValues, items, options } from '@tickets/db';
import { resetDb, seedFixture, seedPlanFixture, testDb, type Fixture } from '../../test/db';
import { runCommand } from '../../command/run-command';
import { itemCreate } from '../../command/item/create';
import { itemUpdate } from '../../command/item/update';
import { createOutboxWorker } from '../../outbox/worker';
import { reposFromWhere, reposOf } from './repos-from-where';

beforeEach(resetDb);
afterAll(resetDb);

function envelope(fx: Fixture) {
  return { commandId: crypto.randomUUID(), actorId: fx.actorId };
}

async function reposHeld(fx: Fixture, itemId: number): Promise<string[]> {
  const rows = await testDb
    .select({ value: options.value })
    .from(itemValues)
    .innerJoin(options, eq(options.id, itemValues.optionId))
    .where(and(eq(itemValues.itemId, itemId), eq(itemValues.fieldId, fx.fieldIdByKey.get('repos')!)));
  return rows.map((r) => r.value).sort();
}

async function current(itemId: number) {
  return (await testDb.select().from(items).where(eq(items.id, itemId)))[0]!;
}

async function update(fx: Fixture, itemId: number, values: Record<string, unknown>) {
  const item = await current(itemId);
  return runCommand(testDb, itemUpdate, envelope(fx), { id: itemId, expectedUpdatedAt: item.updatedAt, values });
}

it('reads each repo once, in the order `where` names them', () => {
  expect(reposOf([
    { repo: 'tickets', part: 'apps/api' }, { repo: 'bh', part: 'packages/ui' }, { repo: 'tickets', part: 'packages/db' },
  ])).toEqual(['tickets', 'bh']);
  expect(reposOf(null)).toEqual([]);
  expect(reposOf([{ part: 'no repo' }, 'tickets'])).toEqual([]);
});

it('sets `repos` from `where` when a feature is made, and again when `where` changes', async () => {
  const fx = await seedPlanFixture();
  const worker = createOutboxWorker(testDb, { rules: [reposFromWhere] });
  const feature = await runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey: 'feature', values: {
      title: 'Add a thing',
      where: [{ repo: 'tickets', part: 'apps/api' }, { repo: 'live gateway', part: 'stacks' }, { repo: 'tickets', part: 'packages/db' }],
    },
  });
  await worker.drainOnce();
  expect(await reposHeld(fx, feature.id)).toEqual(['live gateway', 'tickets']);

  await update(fx, feature.id, { where: [{ repo: 'gateway', part: 'apps/web' }] });
  await worker.drainOnce();
  expect(await reposHeld(fx, feature.id)).toEqual(['gateway']);

  // every write to `repos` was the automation's, a chained command
  const reposChanges = (await testDb.select().from(events)
    .where(and(eq(events.aggregateId, feature.id), eq(events.kind, 'item.field_changed'))))
    .filter((e) => (e.payload as { fieldKey: string }).fieldKey === 'repos');
  expect(reposChanges.length).toBeGreaterThan(0);
  expect(reposChanges.every((e) => e.depth > 0)).toBe(true);
});

it('sets `repos` back from `where` after a write to `repos` alone', async () => {
  const fx = await seedPlanFixture();
  const worker = createOutboxWorker(testDb, { rules: [reposFromWhere] });
  const feature = await runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey: 'feature', values: { title: 'Add a thing', where: [{ repo: 'bh', part: 'packages/ui' }] },
  });
  await worker.drainOnce();
  await update(fx, feature.id, { repos: ['auth', 'bh'] });
  await worker.drainOnce();
  expect(await reposHeld(fx, feature.id)).toEqual(['bh']);
  // the automation's own write settles: draining it changes nothing more
  await worker.drainOnce();
  expect(await worker.drainOnce()).toBe(0);
  expect(await reposHeld(fx, feature.id)).toEqual(['bh']);
});

it('leaves out a repo with no option, and clears `repos` with `where`', async () => {
  const fx = await seedPlanFixture();
  const worker = createOutboxWorker(testDb, { rules: [reposFromWhere] });
  const feature = await runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey: 'feature', values: { title: 'Add a thing', where: [{ repo: 'tickets', part: 'apps/api' }] },
  });
  const ticket = await runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey: 'ticket', parentId: feature.id, values: {
      title: 'Add a part', where: [{ repo: 'nowhere', part: 'x' }, { repo: 'items-core', part: 'src' }],
    },
  });
  await worker.drainOnce();
  expect(await reposHeld(fx, ticket.id)).toEqual(['items-core']);

  await update(fx, ticket.id, { where: null });
  await worker.drainOnce();
  expect(await reposHeld(fx, ticket.id)).toEqual([]);
});

it('does nothing on a type without `where` and `repos`', async () => {
  const fx = await seedFixture();
  const task = await runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A task' },
  });
  const [created] = await testDb.select().from(events)
    .where(and(eq(events.aggregateId, task.id), eq(events.kind, 'item.created')));
  expect(await reposFromWhere.when(created!, testDb)).toBe(false);
});
