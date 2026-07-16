import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemUpdate } from './update';
import { transitionCreate } from '../config/transition';

beforeEach(resetDb);
afterAll(resetDb);

it('rejects a status move that is not in the seeded workflow graph', async () => {
  const fx = await seedFixture();
  const statusFieldId = fx.fieldIdByKey.get('status')!;
  // seed leaves only entry edges for task; backlog -> done is not an edge → 422
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  await expect(
    runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
      id: item.id, expectedUpdatedAt: item.updatedAt, values: { status: 'done' },
    }),
  ).rejects.toMatchObject({ statusCode: 422 });
});

it('allows a move once its edge is added', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const taskId = vocab.typeByKey.get('task')!.id;
  const wf = vocab.workflowField(taskId)!;
  const backlog = vocab.optionsForField(taskId, wf.id).find((o) => o.value === 'backlog')!;
  const done = vocab.optionsForField(taskId, wf.id).find((o) => o.value === 'done')!;
  await runCommand(testDb, transitionCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    fieldId: wf.id, fromOptionId: backlog.id, toOptionId: done.id, itemTypeId: taskId,
  });
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const res = await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: item.id, expectedUpdatedAt: item.updatedAt, values: { status: 'done' },
  });
  expect(res.id).toBe(item.id);
});

it('a requiresComment guard blocks the transition until a comment exists', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const taskId = vocab.typeByKey.get('task')!.id;
  const wf = vocab.workflowField(taskId)!;
  const backlog = vocab.optionsForField(taskId, wf.id).find((o) => o.value === 'backlog')!;
  const done = vocab.optionsForField(taskId, wf.id).find((o) => o.value === 'done')!;
  await runCommand(testDb, transitionCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    fieldId: wf.id, fromOptionId: backlog.id, toOptionId: done.id, itemTypeId: taskId,
    config: { guard: { requiresComment: true } },
  });
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  await expect(
    runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
      id: item.id, expectedUpdatedAt: item.updatedAt, values: { status: 'done' },
    }),
  ).rejects.toMatchObject({ statusCode: 422 });
});
