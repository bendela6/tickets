import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { events, itemTypeFields, itemValues, optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, seedPlanFixture, testDb, type Fixture } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../../command/run-command';
import { itemCreate } from '../../command/item/create';
import { itemUpdate } from '../../command/item/update';
import { createOutboxWorker, type OutboxWorker } from '../../outbox/worker';
import { parentRollup } from './parent-rollup';

beforeEach(resetDb);
afterAll(resetDb);

function envelope(fx: Fixture) {
  return { commandId: crypto.randomUUID(), actorId: fx.actorId };
}

// A software project whose status moves freely (the seed installs entry-only edges).
async function freeSoftware() {
  const fx = await seedFixture();
  await testDb.delete(optionTransitions).where(eq(optionTransitions.fieldId, fx.fieldIdByKey.get('status')!));
  return fx;
}

// A task with `n` subtasks, the create events folded.
async function family(fx: Fixture, worker: OutboxWorker, n: number) {
  const parent = await runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Parent' },
  });
  const children = [];
  for (let i = 0; i < n; i++) {
    children.push(await runCommand(testDb, itemCreate, envelope(fx), {
      projectKey: fx.projectKey, typeKey: 'subtask', parentId: parent.id, values: { title: `Child ${i}` },
    }));
  }
  await worker.drainOnce();
  return { parent, children };
}

// Moves each child to its status in turn, folding each move (the rollup runs on the last).
async function resolve(fx: Fixture, worker: OutboxWorker, moves: [{ id: number; updatedAt?: string }, string][]) {
  for (const [child, status] of moves) {
    await runCommand(testDb, itemUpdate, envelope(fx), {
      id: child.id, expectedUpdatedAt: child.updatedAt!, values: { status },
    });
    await worker.drainOnce();
  }
}

async function statusOf(fx: Fixture, itemId: number) {
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const rows = await testDb
    .select()
    .from(itemValues)
    .where(and(eq(itemValues.itemId, itemId), eq(itemValues.fieldId, fx.fieldIdByKey.get('status')!)));
  const option = vocab.optionById.get(rows[0]!.optionId!)!;
  return { value: option.value, kind: option.kind };
}

// Narrows the task type's status options to `values`.
async function allowTaskStatuses(fx: Fixture, values: string[]) {
  await testDb.update(itemTypeFields)
    .set({ configOverride: { allowedOptionIds: values.map((v) => fx.optionIdByKey.get(`status:${v}`)!) } })
    .where(and(
      eq(itemTypeFields.itemTypeId, fx.typeIdByKey.get('task')!),
      eq(itemTypeFields.fieldId, fx.fieldIdByKey.get('status')!),
    ));
}

it('marks the parent done when its last child resolves', async () => {
  const fx = await freeSoftware();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const { parent, children } = await family(fx, worker, 1);
  await resolve(fx, worker, [[children[0]!, 'done']]);

  expect((await statusOf(fx, parent.id)).kind).toBe('done');
  // the parent update was a chained automation command
  const parentDone = (await testDb.select().from(events)
    .where(and(eq(events.aggregateId, parent.id), eq(events.kind, 'item.field_changed')))).at(-1)!;
  expect(parentDone.depth).toBe(1);
});

it('marks the parent done when its children are done and dropped', async () => {
  const fx = await freeSoftware();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const { parent, children } = await family(fx, worker, 2);
  await resolve(fx, worker, [[children[0]!, 'cancelled'], [children[1]!, 'done']]);
  expect((await statusOf(fx, parent.id)).value).toBe('done');
});

it('drops the parent, never marks it done, when every child is dropped', async () => {
  const fx = await freeSoftware();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const { parent, children } = await family(fx, worker, 2);
  await resolve(fx, worker, [[children[0]!, 'cancelled'], [children[1]!, 'cancelled']]);
  expect(await statusOf(fx, parent.id)).toEqual({ value: 'cancelled', kind: 'dropped' });
});

it('drops the parent to its own first dropped option, not the children\'s', async () => {
  const fx = await freeSoftware();
  await allowTaskStatuses(fx, ['backlog', 'done', 'wont-fix']);
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const { parent, children } = await family(fx, worker, 1);
  await resolve(fx, worker, [[children[0]!, 'cancelled']]);
  expect(await statusOf(fx, parent.id)).toEqual({ value: 'wont-fix', kind: 'dropped' });
});

it('leaves a parent with no dropped option as it is when every child is dropped', async () => {
  const fx = await freeSoftware();
  await allowTaskStatuses(fx, ['backlog', 'in-progress', 'done']);
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const { parent, children } = await family(fx, worker, 2);
  await resolve(fx, worker, [[children[0]!, 'cancelled'], [children[1]!, 'cancelled']]);
  expect((await statusOf(fx, parent.id)).value).toBe('backlog');
});

it('cancels a plan feature whose tickets are all cancelled', async () => {
  const fx = await seedPlanFixture();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const feature = await runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey: 'feature',
    values: { title: 'Add a thing', status: 'planned', where: [{ repo: 'tickets', part: 'apps/api' }] },
  });
  const tickets = [];
  for (const title of ['Add one part', 'Add another']) {
    tickets.push(await runCommand(testDb, itemCreate, envelope(fx), {
      projectKey: fx.projectKey, typeKey: 'ticket', parentId: feature.id, values: { title },
    }));
  }
  await worker.drainOnce();
  await resolve(fx, worker, [[tickets[0]!, 'cancelled'], [tickets[1]!, 'cancelled']]);
  expect(await statusOf(fx, feature.id)).toEqual({ value: 'cancelled', kind: 'dropped' });
});
