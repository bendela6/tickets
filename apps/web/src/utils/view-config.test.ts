import { describe, expect, it } from 'vitest';
import type { Board } from '../api/types';
import { normalizeViewConfig } from './view-config';

function makeBoard(): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 1, itemPrefix: 'CORE', createdAt },
    users: [],
    types: [],
    placements: [],
    options: [],
    transitions: [],
    fields: [
      {
        id: 10,
        schemeId: 1,
        key: 'title',
        label: 'Title',
        type: 'string',
        config: {},
        optionSetId: null,
        archivedAt: null,
      },
      {
        id: 35,
        schemeId: 1,
        key: 'priority',
        label: 'Priority',
        type: 'option',
        config: {},
        optionSetId: 1,
        archivedAt: null,
      },
    ],
    linkTypes: [],
    views: [],
    items: [],
  };
}

describe('normalizeViewConfig', () => {
  it('translates a legacy numeric fieldId column to fieldKey via the board', () => {
    const board = makeBoard();
    const config = normalizeViewConfig(
      { columns: [{ source: 'field', fieldId: 35 }] },
      board,
    );
    expect(config.columns).toContainEqual({
      source: 'field',
      fieldKey: 'priority',
      width: undefined,
      hidden: false,
    });
  });

  it('translates a legacy numeric fieldId sort to fieldKey via the board', () => {
    const board = makeBoard();
    const config = normalizeViewConfig(
      { sort: { source: 'field', fieldId: 35, dir: 'desc' } },
      board,
    );
    expect(config.sort).toEqual({ source: 'field', fieldKey: 'priority', dir: 'desc' });
  });

  it('translates a legacy numeric fieldId filter rule to fieldKey via the board', () => {
    const board = makeBoard();
    const config = normalizeViewConfig(
      { filters: { rules: [{ fieldId: 35, op: 'any-of', values: ['high'] }] } },
      board,
    );
    expect(config.filters.rules).toContainEqual({
      fieldKey: 'priority',
      op: 'any-of',
      values: ['high'],
    });
  });

  it('drops a legacy fieldId column when the field no longer exists on the board, keeping the rest', () => {
    const board = makeBoard();
    const config = normalizeViewConfig(
      {
        columns: [
          { source: 'number' },
          { source: 'field', fieldId: 999 },
          { source: 'field', fieldId: 35 },
        ],
      },
      board,
    );
    expect(config.columns).toEqual([
      { source: 'number', width: undefined, hidden: false },
      { source: 'field', fieldKey: 'priority', width: undefined, hidden: false },
    ]);
  });

  it('round-trips a config already using fieldKey unchanged', () => {
    const board = makeBoard();
    const raw = {
      columns: [{ source: 'field', fieldKey: 'priority', width: 120, hidden: true }],
      sort: { source: 'field', fieldKey: 'priority', dir: 'asc' },
      filters: { rules: [{ fieldKey: 'priority', op: 'none-of', values: ['low'] }] },
    };
    const config = normalizeViewConfig(raw, board);
    expect(config.columns).toContainEqual({
      source: 'field',
      fieldKey: 'priority',
      width: 120,
      hidden: true,
    });
    expect(config.sort).toEqual({ source: 'field', fieldKey: 'priority', dir: 'asc' });
    expect(config.filters.rules).toContainEqual({
      fieldKey: 'priority',
      op: 'none-of',
      values: ['low'],
    });
  });

  it('defaults columns to fieldKey for every unarchived field when none are stored', () => {
    const board = makeBoard();
    const config = normalizeViewConfig({}, board);
    const fieldColumns = config.columns.filter((column) => column.source === 'field');
    expect(fieldColumns.map((column) => column.fieldKey)).toEqual(['title', 'priority']);
  });
});
