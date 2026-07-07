import { expect, test } from 'vitest';
import type { ProjectVocab } from '../vocab/load-project-vocab';
import { buildLogicalFields, buildLogicalTypeFields } from './logical-fields';

const TASK_TYPE_ID = 1;
const BUG_TYPE_ID = 2;

const taskPriority = {
  id: 101,
  ticketTypeId: TASK_TYPE_ID,
  key: 'priority',
  label: 'Priority',
  type: 'select',
  system: false,
  archivedAt: null,
};
const bugPriority = {
  id: 201,
  ticketTypeId: BUG_TYPE_ID,
  key: 'priority',
  label: 'Priority',
  type: 'select',
  system: false,
  archivedAt: null,
};

function vocabFrom(fields: unknown[], optionsByFieldId: [number, unknown[]][]): ProjectVocab {
  return {
    fields,
    optionsByFieldId: new Map(optionsByFieldId),
  } as unknown as ProjectVocab;
}

test('unions options across types for a shared key', () => {
  const vocab = vocabFrom(
    [taskPriority, bugPriority],
    [
      [
        taskPriority.id,
        [
          { id: 1, fieldId: taskPriority.id, value: 'urgent', label: 'Urgent', position: 0, archivedAt: null },
          { id: 2, fieldId: taskPriority.id, value: 'high', label: 'High', position: 1, archivedAt: null },
          { id: 3, fieldId: taskPriority.id, value: 'medium', label: 'Medium', position: 2, archivedAt: null },
        ],
      ],
      [
        bugPriority.id,
        [
          { id: 4, fieldId: bugPriority.id, value: 'high', label: 'High', position: 0, archivedAt: null },
          { id: 5, fieldId: bugPriority.id, value: 'medium', label: 'Medium', position: 1, archivedAt: null },
          { id: 6, fieldId: bugPriority.id, value: 'low', label: 'Low', position: 2, archivedAt: null },
          { id: 7, fieldId: bugPriority.id, value: 'trivial', label: 'Trivial', position: 3, archivedAt: null },
        ],
      ],
    ],
  );

  const out = buildLogicalFields(vocab);
  const prio = out.filter((f) => f.key === 'priority');
  expect(prio.length).toBe(1);
  expect(prio[0]!.options.map((o) => o.value)).toEqual([
    'urgent',
    'high',
    'medium',
    'low',
    'trivial',
  ]);
});

test('the logical id is the smallest per-type field id for the key', () => {
  const vocab = vocabFrom([taskPriority, bugPriority], []);
  const out = buildLogicalFields(vocab);
  const prio = out.find((f) => f.key === 'priority')!;
  expect(prio.id).toBe(taskPriority.id);
});

test('carries label/type/system from the representative row', () => {
  const vocab = vocabFrom([taskPriority, bugPriority], []);
  const out = buildLogicalFields(vocab);
  const prio = out.find((f) => f.key === 'priority')!;
  expect(prio.label).toBe('Priority');
  expect(prio.type).toBe('select');
  expect(prio.system).toBe(false);
});

test('skips a key whose only rows are archived', () => {
  const archivedOnly = {
    id: 301,
    ticketTypeId: TASK_TYPE_ID,
    key: 'legacy',
    label: 'Legacy',
    type: 'text',
    system: false,
    archivedAt: '2026-01-01T00:00:00Z',
  };
  const vocab = vocabFrom([taskPriority, archivedOnly], []);
  const out = buildLogicalFields(vocab);
  expect(out.some((f) => f.key === 'legacy')).toBe(false);
});

test('prefers a non-archived row as representative even when it has a larger id', () => {
  const archivedSmallId = {
    id: 50,
    ticketTypeId: TASK_TYPE_ID,
    key: 'notes',
    label: 'Old Notes',
    type: 'text',
    system: false,
    archivedAt: '2026-01-01T00:00:00Z',
  };
  const liveLargeId = {
    id: 60,
    ticketTypeId: BUG_TYPE_ID,
    key: 'notes',
    label: 'Notes',
    type: 'text',
    system: false,
    archivedAt: null,
  };
  const vocab = vocabFrom([archivedSmallId, liveLargeId], []);
  const out = buildLogicalFields(vocab);
  const notes = out.find((f) => f.key === 'notes')!;
  expect(notes.id).toBe(60);
  expect(notes.label).toBe('Notes');
});

test('an archived row for a key does not contribute options to the union', () => {
  const archivedRow = {
    id: 70,
    ticketTypeId: TASK_TYPE_ID,
    key: 'severity',
    label: 'Severity',
    type: 'select',
    system: false,
    archivedAt: '2026-01-01T00:00:00Z',
  };
  const liveRow = {
    id: 80,
    ticketTypeId: BUG_TYPE_ID,
    key: 'severity',
    label: 'Severity',
    type: 'select',
    system: false,
    archivedAt: null,
  };
  const vocab = vocabFrom(
    [archivedRow, liveRow],
    [
      [archivedRow.id, [{ id: 1, fieldId: archivedRow.id, value: 'critical', label: 'Critical', position: 0, archivedAt: null }]],
      [liveRow.id, [{ id: 2, fieldId: liveRow.id, value: 'minor', label: 'Minor', position: 0, archivedAt: null }]],
    ],
  );
  const out = buildLogicalFields(vocab);
  const severity = out.find((f) => f.key === 'severity')!;
  expect(severity.options.map((o) => o.value)).toEqual(['minor']);
});

// --- buildLogicalTypeFields ---
//
// vocab.fieldsByType is already sorted by position by loadProjectVocab, so
// these fixtures hand buildLogicalTypeFields pre-sorted buckets (it doesn't
// re-sort itself), mirroring the real upstream contract.
function boardVocabFrom(
  types: { id: number; key: string }[],
  fieldsByType: [number, unknown[]][],
  fields: unknown[],
): ProjectVocab {
  return {
    types,
    fieldsByType: new Map(fieldsByType),
    fields,
    optionsByFieldId: new Map(),
  } as unknown as ProjectVocab;
}

test('every derived typeFields[].fieldId exists in the logical fields[].id', () => {
  const taskPriorityRow = {
    id: 401,
    ticketTypeId: TASK_TYPE_ID,
    key: 'priority',
    label: 'Priority',
    type: 'select',
    system: false,
    archivedAt: null,
    position: 0,
    required: true,
  };
  const bugPriorityRow = {
    id: 402,
    ticketTypeId: BUG_TYPE_ID,
    key: 'priority',
    label: 'Priority',
    type: 'select',
    system: false,
    archivedAt: null,
    position: 0,
    required: false,
  };
  const vocab = boardVocabFrom(
    [
      { id: TASK_TYPE_ID, key: 'task' },
      { id: BUG_TYPE_ID, key: 'bug' },
    ],
    [
      [TASK_TYPE_ID, [taskPriorityRow]],
      [BUG_TYPE_ID, [bugPriorityRow]],
    ],
    [taskPriorityRow, bugPriorityRow],
  );

  const fields = buildLogicalFields(vocab);
  const typeFields = buildLogicalTypeFields(vocab, fields);

  const fieldIds = new Set(fields.map((f) => f.id));
  expect(typeFields.length).toBe(2);
  for (const tf of typeFields) {
    expect(fieldIds.has(tf.fieldId)).toBe(true);
  }
});

test('emits typeFields per type in position order with the correct required flag', () => {
  const priorityRow = {
    id: 410,
    ticketTypeId: TASK_TYPE_ID,
    key: 'priority',
    label: 'Priority',
    type: 'select',
    system: false,
    archivedAt: null,
    position: 1,
    required: true,
  };
  const notesRow = {
    id: 411,
    ticketTypeId: TASK_TYPE_ID,
    key: 'notes',
    label: 'Notes',
    type: 'text',
    system: false,
    archivedAt: null,
    position: 0,
    required: false,
  };
  const vocab = boardVocabFrom(
    [{ id: TASK_TYPE_ID, key: 'task' }],
    [[TASK_TYPE_ID, [notesRow, priorityRow]]],
    [notesRow, priorityRow],
  );

  const fields = buildLogicalFields(vocab);
  const typeFields = buildLogicalTypeFields(vocab, fields);

  const notesField = fields.find((f) => f.key === 'notes')!;
  const priorityField = fields.find((f) => f.key === 'priority')!;
  expect(typeFields).toEqual([
    { ticketTypeId: TASK_TYPE_ID, fieldId: notesField.id, position: 0, required: false },
    { ticketTypeId: TASK_TYPE_ID, fieldId: priorityField.id, position: 1, required: true },
  ]);
});

test('a key whose only row is archived contributes no typeFields row', () => {
  const archivedRow = {
    id: 420,
    ticketTypeId: TASK_TYPE_ID,
    key: 'legacy',
    label: 'Legacy',
    type: 'text',
    system: false,
    archivedAt: '2026-01-01T00:00:00Z',
    position: 0,
    required: false,
  };
  const vocab = boardVocabFrom(
    [{ id: TASK_TYPE_ID, key: 'task' }],
    [[TASK_TYPE_ID, [archivedRow]]],
    [archivedRow],
  );

  const fields = buildLogicalFields(vocab);
  const typeFields = buildLogicalTypeFields(vocab, fields);

  expect(fields.some((f) => f.key === 'legacy')).toBe(false);
  expect(typeFields).toEqual([]);
});
