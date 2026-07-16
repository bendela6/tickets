import { expect, test } from 'vitest';
import type { Board } from '../api/types';
import { indexBoard } from './index-board';
import { legalStatusTargets } from './legal-status-targets';

function board(transitions: Board['transitions']): Board {
  return {
    project: { id: 1, key: 'core', name: 'Core', schemeId: 1, itemPrefix: 'C', createdAt: 'x' },
    types: [{ id: 1, schemeId: 1, key: 'task', label: 'Task', position: 1, config: {}, archivedAt: null }],
    fields: [{ id: 10, schemeId: 1, key: 'status', label: 'Status', type: 'option', config: { workflow: true }, optionSetId: 100, archivedAt: null }],
    placements: [{ itemTypeId: 1, fieldId: 10, position: 1, required: false, configOverride: null }],
    options: [
      { id: 1000, optionSetId: 100, value: 'todo', label: 'To do', position: 1, kind: 'todo', config: {}, archivedAt: null },
      { id: 1001, optionSetId: 100, value: 'wip', label: 'WIP', position: 2, kind: 'active', config: {}, archivedAt: null },
      { id: 1002, optionSetId: 100, value: 'done', label: 'Done', position: 3, kind: 'done', config: {}, archivedAt: null },
    ],
    transitions, linkTypes: [], views: [], users: [],
    items: [{ id: 500, number: 1, typeId: 1, parentId: null, createdBy: 1, archivedAt: null, createdAt: 'x', updatedAt: 'x', values: { status: 'todo' }, comments: [], links: [] }],
  };
}

test('no edges ⇒ all options', () => {
  const b = board([]);
  const ix = indexBoard(b);
  expect(legalStatusTargets(b, ix, b.items[0]!, 1).map((o) => o.value)).toEqual(['todo', 'wip', 'done']);
});

test('with edges ⇒ current + reachable', () => {
  const b = board([{ id: 1, fieldId: 10, itemTypeId: null, fromOptionId: 1000, toOptionId: 1001, config: null }]);
  const ix = indexBoard(b);
  // from todo: current (todo) + wip
  expect(legalStatusTargets(b, ix, b.items[0]!, 1).map((o) => o.value).sort()).toEqual(['todo', 'wip']);
});

test('creation uses entry edges (from null)', () => {
  const b = board([{ id: 1, fieldId: 10, itemTypeId: 1, fromOptionId: null, toOptionId: 1000, config: null }]);
  const ix = indexBoard(b);
  expect(legalStatusTargets(b, ix, null, 1).map((o) => o.value)).toEqual(['todo']);
});
