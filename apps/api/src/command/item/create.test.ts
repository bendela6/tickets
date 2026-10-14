import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, itemValues, items, optionTransitions, options } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { fieldUpdate } from '../config/field';

beforeEach(resetDb);
afterAll(resetDb);

const env = (actorId: number, id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') => ({ commandId: id, actorId });

it('creates an item with values, defaults the workflow field, and emits item.created', async () => {
  const fx = await seedFixture();
  const typeKey = 'task'; // a type the scheme defines with a status field — adjust to the seed
  const result = await runCommand(testDb, itemCreate, env(fx.actorId), {
    projectKey: fx.projectKey,
    typeKey,
    values: { title: 'First' },
  });
  expect(result.number).toBe(1);

  const itemRows = await testDb.select().from(items).where(eq(items.id, result.id));
  expect(itemRows).toHaveLength(1);

  const created = await testDb.select().from(events).where(eq(events.kind, 'item.created'));
  expect(created).toHaveLength(1);
  expect(created[0]!.projectId).toBe(fx.projectId); // item events carry project_id
  expect((created[0]!.payload as { values: Record<string, unknown> }).values.status).toBeDefined();

  const valueRows = await testDb.select().from(itemValues).where(eq(itemValues.itemId, result.id));
  expect(valueRows.length).toBeGreaterThan(0);
});

it('rejects a missing required field', async () => {
  const fx = await seedFixture();
  await expect(
    runCommand(testDb, itemCreate, env(fx.actorId, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), {
      projectKey: fx.projectKey,
      typeKey: 'task',
      values: {}, // no title
    }),
  ).rejects.toThrow(/required/);
});

it('does not block creation on a required field that has been archived', async () => {
  const fx = await seedFixture();
  // "title" is placed required on task in the seed (packages/db/src/seed/software-scheme.ts).
  const titleFieldId = fx.fieldIdByKey.get('title');
  expect(titleFieldId).toBeDefined();

  await runCommand(testDb, fieldUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: titleFieldId!,
    archived: true,
  });

  // create.ts gate is `if (placement?.required && !field.archivedAt)` — an archived required field must be excluded.
  const result = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey,
    typeKey: 'task',
    values: {}, // no title, but title is archived so it should not block creation
  });

  const itemRows = await testDb.select().from(items).where(eq(items.id, result.id));
  expect(itemRows).toHaveLength(1);
});

// A bug may only start at triage (its entry edge). tickets' imported options
// put "todo" before "triage", so the lowest-position to-do the bug allows was
// "todo", and a bug made without a status, as the detail's add row makes one,
// was refused: "todo" is not a valid starting option.
it('starts a type at a status its entry edges allow, whatever the options\' order', async () => {
  const fx = await seedFixture();
  await testDb.update(options).set({ position: -1 }).where(eq(options.id, fx.optionIdByKey.get('status:todo')!));

  const result = await runCommand(testDb, itemCreate, env(fx.actorId), {
    projectKey: fx.projectKey,
    typeKey: 'bug',
    values: { title: 'Rows jump on resize' },
  });

  const [created] = await testDb.select().from(events).where(eq(events.kind, 'item.created'));
  expect(created!.aggregateId).toBe(result.id);
  expect((created!.payload as { values: Record<string, unknown> }).values.status).toBe('triage');
});

it('without entry edges, still starts a type at its lowest-position to-do', async () => {
  const fx = await seedFixture();
  await testDb.update(options).set({ position: -1 }).where(eq(options.id, fx.optionIdByKey.get('status:todo')!));
  await testDb.delete(optionTransitions).where(eq(optionTransitions.toOptionId, fx.optionIdByKey.get('status:triage')!));

  await runCommand(testDb, itemCreate, env(fx.actorId), {
    projectKey: fx.projectKey,
    typeKey: 'bug',
    values: { title: 'Rows jump on resize' },
  });

  const [created] = await testDb.select().from(events).where(eq(events.kind, 'item.created'));
  expect((created!.payload as { values: Record<string, unknown> }).values.status).toBe('todo');
});
