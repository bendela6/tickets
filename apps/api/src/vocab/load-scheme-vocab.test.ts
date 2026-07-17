import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { loadSchemeVocab } from './load-scheme-vocab';

beforeEach(resetDb);
afterAll(resetDb);

it('loads placed fields, options, and the workflow field for a seeded project', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  expect(vocab.project.id).toBe(fx.projectId);

  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id));
  expect(typeId).toBeDefined();

  const wf = vocab.workflowField(typeId!);
  expect(wf?.key).toBe('status');
  expect((wf!.config as { workflow?: boolean }).workflow).toBe(true);

  const statusOptions = vocab.optionsForField(typeId!, wf!.id);
  expect(statusOptions.length).toBeGreaterThan(0);
  expect(statusOptions.some((o) => o.kind === 'todo')).toBe(true);

  const initial = vocab.initialOption(typeId!);
  expect(initial?.kind).toBe('todo');

  expect(vocab.fieldByTypeKey.get(`${typeId}:status`)?.id).toBe(wf!.id);
});

it('narrows a placed field\'s options by the placement\'s allowedOptionIds override', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });

  const epicId = fx.typeIdByKey.get('epic')!;
  const statusFieldId = fx.fieldIdByKey.get('status')!;

  // epic's status placement narrows the full 12-option status set down to 5:
  // see packages/db/src/seed/software-scheme.ts's epic placement.
  const expectedValues = ['backlog', 'in-progress', 'blocked', 'done', 'cancelled'];
  const expectedIds = expectedValues.map((v) => fx.optionIdByKey.get(`status:${v}`)!).sort((a, b) => a - b);

  const fullStatusOptions = vocab.optionsByFieldId.get(statusFieldId) ?? [];
  expect(fullStatusOptions.length).toBe(12);

  const narrowed = vocab.optionsForField(epicId, statusFieldId);
  expect(narrowed.length).toBe(5);
  expect(narrowed.length).toBeLessThan(fullStatusOptions.length);
  expect(narrowed.map((o) => o.id).sort((a, b) => a - b)).toEqual(expectedIds);
});
