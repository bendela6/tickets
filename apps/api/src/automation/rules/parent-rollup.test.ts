import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { events, itemTypeFields, itemValues, items, optionTransitions } from '@tickets/db';
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

// ---- TK-80.8: the rollup undoes its own close when its rule no longer holds

// Drains until nothing is left: a parent the rollup moves writes its own
// event during a drain, which the next one folds (and so up the tree).
async function settle(worker: OutboxWorker) {
  for (let i = 0; i < 12 && (await worker.drainOnce()) > 0; i++);
}

async function fresh(itemId: number) {
  return (await testDb.select().from(items).where(eq(items.id, itemId)))[0]!;
}

async function move(fx: Fixture, worker: OutboxWorker, itemId: number, values: Record<string, unknown>) {
  const item = await fresh(itemId);
  await runCommand(testDb, itemUpdate, envelope(fx), { id: item.id, expectedUpdatedAt: item.updatedAt, values });
  await settle(worker);
}

async function restore(fx: Fixture, worker: OutboxWorker, itemId: number) {
  const item = await fresh(itemId);
  await runCommand(testDb, itemUpdate, envelope(fx), { id: item.id, expectedUpdatedAt: item.updatedAt, restoreStatus: true });
  await settle(worker);
}

async function planItem(fx: Fixture, typeKey: string, parentId: number | null, values: Record<string, unknown> = {}) {
  const where = typeKey === 'feature' ? { where: [{ repo: 'tickets', part: 'apps/api' }] } : {};
  return runCommand(testDb, itemCreate, envelope(fx), {
    projectKey: fx.projectKey, typeKey, parentId, values: { title: `Add a ${typeKey}`, ...where, ...values },
  });
}

it('returns a parent it cancelled to its status before, when a child is restored', async () => {
  const fx = await seedPlanFixture();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const feature = await planItem(fx, 'feature', null, { status: 'planned' });
  const t1 = await planItem(fx, 'ticket', feature.id);
  const t2 = await planItem(fx, 'ticket', feature.id);
  await settle(worker);
  await move(fx, worker, t1.id, { status: 'cancelled' });
  await move(fx, worker, t2.id, { status: 'cancelled' });
  expect((await statusOf(fx, feature.id)).value).toBe('cancelled');

  await restore(fx, worker, t2.id);
  expect((await statusOf(fx, t2.id)).value).toBe('todo');
  expect((await statusOf(fx, feature.id)).value).toBe('planned');
});

it('returns a parent it marked done to its status before, when a done child is reopened', async () => {
  const fx = await freeSoftware();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const { parent, children } = await family(fx, worker, 2);
  await move(fx, worker, parent.id, { status: 'in-progress' });
  await move(fx, worker, children[0]!.id, { status: 'done' });
  await move(fx, worker, children[1]!.id, { status: 'cancelled' });
  expect((await statusOf(fx, parent.id)).value).toBe('done');

  await move(fx, worker, children[0]!.id, { status: 'todo' });
  expect((await statusOf(fx, parent.id)).value).toBe('in-progress');
});

it('reopens a parent it closed when a child is added, done or cancelled', async () => {
  const fx = await freeSoftware();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const done = await family(fx, worker, 1);
  await move(fx, worker, done.children[0]!.id, { status: 'done' });
  const cancelled = await family(fx, worker, 1);
  await move(fx, worker, cancelled.children[0]!.id, { status: 'cancelled' });
  expect((await statusOf(fx, done.parent.id)).value).toBe('done');
  expect((await statusOf(fx, cancelled.parent.id)).value).toBe('cancelled');

  for (const { parent } of [done, cancelled]) {
    await runCommand(testDb, itemCreate, envelope(fx), {
      projectKey: fx.projectKey, typeKey: 'subtask', parentId: parent.id, values: { title: 'One more' },
    });
  }
  await settle(worker);
  expect((await statusOf(fx, done.parent.id)).value).toBe('backlog');
  expect((await statusOf(fx, cancelled.parent.id)).value).toBe('backlog');
});

it('reopens a parent it closed when a child is moved in, and closes the one it left', async () => {
  const fx = await freeSoftware();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const closed = await family(fx, worker, 1);
  await move(fx, worker, closed.children[0]!.id, { status: 'done' });
  const open = await family(fx, worker, 2);
  await move(fx, worker, open.children[0]!.id, { status: 'done' });
  expect((await statusOf(fx, closed.parent.id)).value).toBe('done');
  expect((await statusOf(fx, open.parent.id)).value).toBe('backlog');

  // the open child moves from `open` into `closed`
  const mover = await fresh(open.children[1]!.id);
  await runCommand(testDb, itemUpdate, envelope(fx), {
    id: mover.id, expectedUpdatedAt: mover.updatedAt, parentId: closed.parent.id,
  });
  await settle(worker);
  expect((await statusOf(fx, closed.parent.id)).value).toBe('backlog');
  expect((await statusOf(fx, open.parent.id)).value).toBe('done');
});

it('leaves alone a parent a person closed, by hand or after the rollup did', async () => {
  const fx = await freeSoftware();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  // closed by hand while its child is open
  const byHand = await family(fx, worker, 1);
  await move(fx, worker, byHand.parent.id, { status: 'done' });
  await move(fx, worker, byHand.children[0]!.id, { status: 'in-progress' });
  expect((await statusOf(fx, byHand.parent.id)).value).toBe('done');

  // closed by the rollup, then cancelled by hand
  const after = await family(fx, worker, 1);
  await move(fx, worker, after.children[0]!.id, { status: 'done' });
  expect((await statusOf(fx, after.parent.id)).value).toBe('done');
  await move(fx, worker, after.parent.id, { status: 'cancelled' });
  await move(fx, worker, after.children[0]!.id, { status: 'todo' });
  expect((await statusOf(fx, after.parent.id)).value).toBe('cancelled');
});

it('cancels a parent it marked done once its done child is cancelled too, and reopens it past both', async () => {
  const fx = await freeSoftware();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const { parent, children } = await family(fx, worker, 2);
  await move(fx, worker, children[0]!.id, { status: 'done' });
  await move(fx, worker, children[1]!.id, { status: 'cancelled' });
  expect((await statusOf(fx, parent.id)).value).toBe('done');
  await move(fx, worker, children[0]!.id, { status: 'cancelled' });
  expect((await statusOf(fx, parent.id)).value).toBe('cancelled');
  await move(fx, worker, children[1]!.id, { status: 'todo' });
  expect((await statusOf(fx, parent.id)).value).toBe('backlog');
});

it('reopens up the tree: a grandparent the rollup closed reopens with its child', async () => {
  const fx = await seedPlanFixture();
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  const epic = await planItem(fx, 'epic', null);
  const feature = await planItem(fx, 'feature', epic.id, { status: 'in-progress' });
  const ticket = await planItem(fx, 'ticket', feature.id);
  await settle(worker);
  await move(fx, worker, ticket.id, { status: 'done' });
  expect((await statusOf(fx, feature.id)).value).toBe('done');
  expect((await statusOf(fx, epic.id)).value).toBe('done');

  await move(fx, worker, ticket.id, { status: 'todo' });
  expect((await statusOf(fx, feature.id)).value).toBe('in-progress');
  expect((await statusOf(fx, epic.id)).value).toBe('todo');
  // the epic's reopen is the rollup's, two steps down the chain from the ticket's
  const reopened = (await testDb.select().from(events)
    .where(and(eq(events.aggregateId, epic.id), eq(events.kind, 'item.field_changed')))).at(-1)!;
  expect(reopened.payload).toMatchObject({ fieldKey: 'status', from: 'done', to: 'todo' });
  expect(reopened.depth).toBe(2);
});
