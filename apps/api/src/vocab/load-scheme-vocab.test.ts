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
