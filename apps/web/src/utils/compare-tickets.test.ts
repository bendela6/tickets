import { expect, test } from 'vitest';
import type { Board, Item } from '../api/types';
import { compareTickets, compareTicketsBy } from './compare-tickets';
import { indexBoard, type BoardIndexes } from './index-board';

/**
 * Two projects that agree on the field KEY but disagree on the option ORDER:
 * `core` ranks low before high, `app` ranks high before low. That disagreement
 * is the whole point — option sorting goes by stored position, so a row can
 * only be ranked correctly through its own project's board.
 */
function board(key: string, optionSetId: number, order: string[]): Board {
  return {
    project: { id: 1, key, name: key, schemeId: 1, itemPrefix: key.toUpperCase(), createdAt: 'x' },
    types: [{ id: 1, schemeId: 1, key: 'task', label: 'Task', position: 1, config: {}, archivedAt: null }],
    fields: [
      {
        id: 10,
        schemeId: 1,
        key: 'priority',
        label: 'Priority',
        type: 'option',
        config: {},
        optionSetId,
        archivedAt: null,
      },
    ],
    placements: [{ itemTypeId: 1, fieldId: 10, position: 1, required: false, configOverride: null }],
    options: order.map((value, index) => ({
      id: optionSetId + index,
      optionSetId,
      value,
      label: value,
      position: index + 1,
      kind: null,
      config: {},
      archivedAt: null,
    })),
    transitions: [], linkTypes: [], targetTypes: [], views: [], users: [], childTypes: [],
    items: [],
  };
}

function item(number: number, priority: string): Item {
  return {
    id: 500 + number,
    number,
    typeId: 1,
    parentId: null,
    createdBy: 1,
    archivedAt: null,
    createdAt: 'x',
    updatedAt: 'x',
    values: { priority },
    comments: [],
    links: [],
  };
}

type Row = { indexes: BoardIndexes; ticket: Item };

const core = indexBoard(board('core', 100, ['low', 'high']));
const app = indexBoard(board('app', 200, ['high', 'low']));

const rows: Row[] = [
  { indexes: core, ticket: item(1, 'low') }, // core ranks low first  -> 0
  { indexes: core, ticket: item(2, 'high') }, // core ranks high second -> 1
  { indexes: app, ticket: item(3, 'high') }, // app ranks high first  -> 0
  { indexes: app, ticket: item(4, 'low') }, // app ranks low second  -> 1
];

function order(sorted: Row[]): number[] {
  return sorted.map((row) => row.ticket.number);
}

test('ranks each row through its own project, not the first one it saw', () => {
  const sorted = [...rows].sort(
    compareTicketsBy<Row>(
      { source: 'field', fieldKey: 'priority', dir: 'asc' },
      (row) => row.indexes,
      (row) => row.ticket,
    ),
  );
  // Both "first option" rows lead, then both "second option" rows; item number
  // breaks the tie. Ranking everything through `core` would put 4 before 3 and
  // yield [1, 4, 2, 3] — the bug this signature exists to prevent.
  expect(order(sorted)).toEqual([1, 3, 2, 4]);
});

test('reverses within the same option positions on desc', () => {
  const sorted = [...rows].sort(
    compareTicketsBy<Row>(
      { source: 'field', fieldKey: 'priority', dir: 'desc' },
      (row) => row.indexes,
      (row) => row.ticket,
    ),
  );
  expect(order(sorted)).toEqual([2, 4, 1, 3]);
});

test('falls back to item number when no sort is set', () => {
  const sorted = [...rows].sort(
    compareTicketsBy<Row>(
      null,
      (row) => row.indexes,
      (row) => row.ticket,
    ),
  );
  expect(order(sorted)).toEqual([1, 2, 3, 4]);
});

test('compareTickets still orders bare items on one board', () => {
  const items = [item(2, 'high'), item(1, 'low')];
  const sorted = [...items].sort(compareTickets(core, { source: 'field', fieldKey: 'priority', dir: 'asc' }));
  expect(sorted.map((t) => t.number)).toEqual([1, 2]);
});
