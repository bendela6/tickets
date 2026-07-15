import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { loadSchemeVocab } from '../vocab/load-scheme-vocab';
import { buildValueRows } from './build-value-rows';
import { renderValue } from './render-value';

beforeEach(resetDb);
afterAll(resetDb);

it('builds and renders each field type round-trip', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  // Pick a type whose workflow field actually allows a 'todo' status option
  // (not every type does — e.g. 'epic' has no 'todo' — so a plain "first type
  // with a workflow field" search is not enough).
  const typeId = [...vocab.typeById.keys()].find((id) => {
    const wf = vocab.workflowField(id);
    return wf && vocab.optionsForField(id, wf.id).some((o) => o.value === 'todo');
  })!;

  const titleField = vocab.fieldByTypeKey.get(`${typeId}:title`)!;
  const titleRows = buildValueRows(vocab, typeId, 'title', 'Hello');
  expect(titleRows).toEqual([{ fieldId: titleField.id, valueText: 'Hello' }]);

  const statusRows = buildValueRows(vocab, typeId, 'status', 'todo');
  expect(statusRows).toHaveLength(1);
  expect(statusRows[0]!.optionId).toBeDefined();

  const rendered = renderValue(vocab, {
    id: 0, itemId: 0, fieldId: statusRows[0]!.fieldId,
    valueText: null, valueNumber: null, valueDate: null, valueBool: null,
    valueJson: null, optionId: statusRows[0]!.optionId!, valueUserId: null,
  });
  expect(rendered).toBe('todo');

  expect(buildValueRows(vocab, typeId, 'title', null)).toEqual([]);
});

it('rejects a wrong-typed value and an unknown option', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id))!;
  expect(() => buildValueRows(vocab, typeId, 'title', 123)).toThrow(/expects a string/);
  expect(() => buildValueRows(vocab, typeId, 'status', 'nonsense')).toThrow(/no option/);
});
