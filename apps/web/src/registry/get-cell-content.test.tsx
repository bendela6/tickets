import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { Board } from '../api/types';
import { indexBoard } from '../utils/index-board';
import { getCellContent } from './get-cell-content';

function board(): Board {
  return {
    project: { id: 1, key: 'core', name: 'Core', schemeId: 1, itemPrefix: 'CORE', createdAt: 'x' },
    types: [{ id: 1, schemeId: 1, key: 'task', label: 'Task', position: 1, config: {}, archivedAt: null }],
    fields: [
      { id: 10, schemeId: 1, key: 'status', label: 'Status', type: 'option', config: { workflow: true }, optionSetId: 100, archivedAt: null },
      { id: 11, schemeId: 1, key: 'title', label: 'Title', type: 'string', config: {}, optionSetId: null, archivedAt: null },
      { id: 12, schemeId: 1, key: 'priority', label: 'Priority', type: 'option', config: {}, optionSetId: 200, archivedAt: null },
      { id: 13, schemeId: 1, key: 'assignee', label: 'Assignee', type: 'user', config: {}, optionSetId: null, archivedAt: null },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 10, position: 1, required: false, configOverride: null },
      { itemTypeId: 1, fieldId: 11, position: 2, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 12, position: 3, required: false, configOverride: null },
      { itemTypeId: 1, fieldId: 13, position: 4, required: false, configOverride: null },
    ],
    options: [
      { id: 1000, optionSetId: 100, value: 'todo', label: 'To do', position: 1, kind: 'todo', config: {}, archivedAt: null },
      { id: 1001, optionSetId: 100, value: 'active', label: 'In Progress', position: 2, kind: 'active', config: {}, archivedAt: null },
      { id: 2000, optionSetId: 200, value: 'high', label: 'High', position: 1, kind: null, config: { color: '#c25425' }, archivedAt: null },
    ],
    transitions: [],
    linkTypes: [],
    targetTypes: [],
    views: [],
    childTypes: [],
    users: [{ id: 7, name: 'Ada', email: null, kind: 'human', archivedAt: null }],
    items: [
      {
        id: 500,
        number: 1,
        typeId: 1,
        parentId: null,
        createdBy: 7,
        archivedAt: null,
        createdAt: 'x',
        updatedAt: 'x',
        values: { status: 'active', title: 'Do it', priority: 'high', assignee: 7 },
        comments: [],
        links: [],
      },
    ],
  };
}

test('an option field renders the option label', () => {
  const b = board();
  const ix = indexBoard(b);
  const field = ix.fieldById.get(12)!;
  render(<>{getCellContent(field, 'high', ix, 1)}</>);
  expect(screen.getByText('High')).toBeInTheDocument();
});

test('the workflow field renders a status-colored pill', () => {
  const b = board();
  const ix = indexBoard(b);
  const field = ix.fieldById.get(10)!;
  render(<>{getCellContent(field, 'active', ix, 1)}</>);
  const badge = screen.getByText('In Progress').closest('span');
  expect(badge).toHaveClass('bg-blue-3');
});

test('a user field renders the user name', () => {
  const b = board();
  const ix = indexBoard(b);
  const field = ix.fieldById.get(13)!;
  render(<>{getCellContent(field, 7, ix, 1)}</>);
  expect(screen.getByText('Ada')).toBeInTheDocument();
});
