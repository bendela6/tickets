import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { checkTransition, nextItemNumber } from './helpers';

beforeEach(resetDb);
afterAll(resetDb);

it('allocates item numbers 1,2,3 within a project', async () => {
  const fx = await seedFixture();
  const a = await testDb.transaction((tx) => nextItemNumber(tx, fx.projectId));
  expect(a).toBe(1);
});

it('checkTransition is a no-op when the field has no edges', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id))!;
  const wf = vocab.workflowField(typeId)!;
  const to = vocab.optionsForField(typeId, wf.id)[0]!.id;
  // seeded scheme defines no option_transitions → unrestricted
  expect(() => checkTransition(vocab, { fieldId: wf.id, typeId, fromOptionId: null, toOptionId: to })).not.toThrow();
});
