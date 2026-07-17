import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { fieldCreate } from '../command/config/field';
import { optionCreate } from '../command/config/option';
import { runCommand } from '../command/run-command';
import { loadSchemeVocab } from '../vocab/load-scheme-vocab';
import { buildValueRows } from './build-value-rows';

beforeEach(resetDb);
afterAll(resetDb);

it('rejects non-finite numbers but accepts finite ones (M1)', async () => {
  const fx = await seedFixture();
  const taskId = fx.typeIdByKey.get('task')!;
  // The seed places no plain `number` field on any type — add one via the
  // field.create command so a genuine number field is reachable.
  await runCommand(testDb, fieldCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemTypeId: taskId, key: 'story_points', label: 'Story points', type: 'number',
  });
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });

  expect(() => buildValueRows(vocab, taskId, 'story_points', Infinity)).toThrow(/finite/);
  expect(() => buildValueRows(vocab, taskId, 'story_points', -Infinity)).toThrow(/finite/);
  expect(() => buildValueRows(vocab, taskId, 'story_points', NaN)).toThrow(/finite/);
  expect(() => buildValueRows(vocab, taskId, 'story_points', 5)).not.toThrow();
});

it('rejects a non-ISO date string but accepts a strict ISO date (M2)', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  // 'task' has no date field placed; 'spike' has 'target_date'.
  const spikeId = vocab.typeByKey.get('spike')!.id;

  expect(() => buildValueRows(vocab, spikeId, 'target_date', 'July 4, 2026')).toThrow(/ISO/);
  expect(() => buildValueRows(vocab, spikeId, 'target_date', '2026-07-04')).not.toThrow();
});

it('rejects duplicate option values in a multi field but allows two distinct ones (N4)', async () => {
  const fx = await seedFixture();
  const vocab0 = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const taskId = vocab0.typeByKey.get('task')!.id;
  // 'labels' is a multi-option field, but its option set is empty in the
  // seed — add two real options via the option.create command so the
  // dedupe guard is exercised against genuinely-known options, not the
  // unrelated "unknown option" guard.
  const labelsField = vocab0.fieldByTypeKey.get(`${taskId}:labels`)!;
  await runCommand(testDb, optionCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    fieldId: labelsField.id, value: 'bug', label: 'Bug',
  });
  await runCommand(testDb, optionCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    fieldId: labelsField.id, value: 'urgent', label: 'Urgent',
  });
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });

  expect(() => buildValueRows(vocab, taskId, 'labels', ['bug', 'bug'])).toThrow(/duplicate/);
  expect(() => buildValueRows(vocab, taskId, 'labels', ['bug', 'urgent'])).not.toThrow();
});
