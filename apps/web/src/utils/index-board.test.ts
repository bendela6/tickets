import { expect, test } from 'vitest';
import type { Board } from '../api/types';
import { indexBoard } from './index-board';

function board(): Board {
  return {
    project: { id: 1, key: 'core', name: 'Core', schemeId: 1, itemPrefix: 'CORE', createdAt: 'x' },
    types: [{ id: 1, schemeId: 1, key: 'task', label: 'Task', config: {}, archivedAt: null }],
    fields: [
      { id: 10, schemeId: 1, key: 'status', label: 'Status', type: 'option', config: { workflow: true }, optionSetId: 100, archivedAt: null },
      { id: 11, schemeId: 1, key: 'title', label: 'Title', type: 'string', config: {}, optionSetId: null, archivedAt: null },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 11, position: 1, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 10, position: 2, required: false, configOverride: { allowedOptionIds: [1000, 1002] } },
    ],
    options: [
      { id: 1000, optionSetId: 100, value: 'todo', label: 'To do', position: 1, kind: 'todo', config: {}, archivedAt: null },
      { id: 1001, optionSetId: 100, value: 'wip', label: 'WIP', position: 2, kind: 'active', config: {}, archivedAt: null },
      { id: 1002, optionSetId: 100, value: 'done', label: 'Done', position: 3, kind: 'done', config: {}, archivedAt: null },
    ],
    transitions: [], linkTypes: [], views: [], users: [{ id: 7, name: 'A', email: null, kind: 'human', archivedAt: null }],
    items: [
      { id: 500, number: 1, typeId: 1, parentId: null, createdBy: 7, archivedAt: null, createdAt: 'x', updatedAt: 'x', values: { status: 'todo', title: 'P' }, comments: [], links: [] },
      { id: 501, number: 2, typeId: 1, parentId: 500, createdBy: 7, archivedAt: null, createdAt: 'x', updatedAt: 'x', values: {}, comments: [], links: [] },
    ],
  };
}

test('indexes maps, workflow field, per-type option allowlist, children', () => {
  const ix = indexBoard(board());
  expect(ix.typeById.get(1)!.key).toBe('task');
  expect(ix.itemByNumber.get(1)!.id).toBe(500);
  expect(ix.workflowField(1)!.key).toBe('status');
  // allowlist narrows the field's set to todo+done (not wip)
  expect(ix.optionsForField(1, ix.workflowField(1)!).map((o) => o.value)).toEqual(['todo', 'done']);
  expect(ix.optionByValue(ix.workflowField(1)!, 'done')!.id).toBe(1002);
  expect(ix.childrenByParent.get(500)!.map((c) => c.id)).toEqual([501]);
});
