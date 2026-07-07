import { expect, test } from 'vitest';
import type { ProjectVocab } from '../vocab/load-project-vocab';
import { buildValueRows } from './build-value-rows';

const TASK_TYPE_ID = 1;
const BUG_TYPE_ID = 2;

const taskPriorityField = { id: 101, key: 'priority', type: 'select', archivedAt: null };
const bugPriorityField = { id: 201, key: 'priority', type: 'select', archivedAt: null };
const taskStatusField = { id: 102, key: 'status', type: 'status', archivedAt: null };
const bugStatusField = { id: 202, key: 'status', type: 'status', archivedAt: null };
const bugSeverityField = { id: 203, key: 'severity', type: 'select', archivedAt: null };

const vocab = {
  fieldByTypeKey: new Map([
    [`${TASK_TYPE_ID}:priority`, taskPriorityField],
    [`${TASK_TYPE_ID}:status`, taskStatusField],
    [`${BUG_TYPE_ID}:priority`, bugPriorityField],
    [`${BUG_TYPE_ID}:status`, bugStatusField],
    [`${BUG_TYPE_ID}:severity`, bugSeverityField],
  ]),
  optionsByFieldId: new Map([
    [
      taskPriorityField.id,
      [{ id: 1001, fieldId: taskPriorityField.id, value: 'high', archivedAt: null }],
    ],
    [
      bugPriorityField.id,
      [{ id: 2001, fieldId: bugPriorityField.id, value: 'high', archivedAt: null }],
    ],
  ]),
  statusByTypeKey: new Map([
    [`${TASK_TYPE_ID}:in-progress`, { id: 11, key: 'in-progress', archivedAt: null }],
    [`${BUG_TYPE_ID}:in-progress`, { id: 22, key: 'in-progress', archivedAt: null }],
  ]),
} as unknown as ProjectVocab;

test('resolves the field for the ticket type', () => {
  const rows = buildValueRows(vocab, 'priority', 'high', TASK_TYPE_ID);
  expect(rows[0]!.fieldId).toBe(vocab.fieldByTypeKey.get(`${TASK_TYPE_ID}:priority`)!.id);
});

test('rejects a field the type does not own', () => {
  expect(() => buildValueRows(vocab, 'severity', 'high', TASK_TYPE_ID)).toThrow(/unknown field/);
});

test('a shared field key resolves to a different field id per type', () => {
  const taskRows = buildValueRows(vocab, 'priority', 'high', TASK_TYPE_ID);
  const bugRows = buildValueRows(vocab, 'priority', 'high', BUG_TYPE_ID);
  expect(taskRows[0]!.fieldId).toBe(taskPriorityField.id);
  expect(bugRows[0]!.fieldId).toBe(bugPriorityField.id);
  expect(taskRows[0]!.fieldId).not.toBe(bugRows[0]!.fieldId);
});

test('status resolves per type', () => {
  const taskRows = buildValueRows(vocab, 'status', 'in-progress', TASK_TYPE_ID);
  const bugRows = buildValueRows(vocab, 'status', 'in-progress', BUG_TYPE_ID);
  expect(taskRows[0]!.statusId).toBe(11);
  expect(bugRows[0]!.statusId).toBe(22);
});

test('unknown status for the type throws', () => {
  expect(() => buildValueRows(vocab, 'status', 'nope', TASK_TYPE_ID)).toThrow();
});

test('an archived field is treated as unknown', () => {
  const archivedVocab = {
    fieldByTypeKey: new Map([
      [`${TASK_TYPE_ID}:priority`, { ...taskPriorityField, archivedAt: '2026-01-01T00:00:00Z' }],
    ]),
    optionsByFieldId: new Map(),
    statusByTypeKey: new Map(),
  } as unknown as ProjectVocab;
  expect(() => buildValueRows(archivedVocab, 'priority', 'high', TASK_TYPE_ID)).toThrow(
    /unknown field/,
  );
});

test('null clears the field regardless of type', () => {
  expect(buildValueRows(vocab, 'priority', null, TASK_TYPE_ID)).toEqual([]);
});
