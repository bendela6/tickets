import { describe, it, expect } from 'vitest';
import { sortRows } from './sort-rows';
import type { Column, SortBy } from './types';

interface Row {
  id: string;
  name: string;
  count: number;
  done: boolean;
  at: Date | null;
  note?: string | null;
}

const row = (over: Partial<Row> & { id: string }): Row => ({
  name: '',
  count: 0,
  done: false,
  at: null,
  ...over,
});

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', value: (r) => r.name },
  { key: 'count', header: 'Count', value: (r) => r.count },
  { key: 'done', header: 'Done', value: (r) => r.done },
  { key: 'at', header: 'At', value: (r) => r.at },
  { key: 'note', header: 'Note', value: (r) => r.note },
  // No `value`: there is nothing to compare rows by.
  { key: 'rendered', header: 'Rendered', render: () => null },
];

const ids = (rows: Row[]) => rows.map((r) => r.id);
const asc = (field: string): SortBy[] => [{ field, direction: 'asc' }];
const desc = (field: string): SortBy[] => [{ field, direction: 'desc' }];

describe('sortRows — types', () => {
  it('orders numbers numerically, not lexically', () => {
    const rows = [
      row({ id: 'a', count: 10 }),
      row({ id: 'b', count: 9 }),
      row({ id: 'c', count: 100 }),
    ];
    expect(ids(sortRows(rows, asc('count'), columns))).toEqual(['b', 'a', 'c']);
  });

  it('reverses numbers on desc', () => {
    const rows = [
      row({ id: 'a', count: 10 }),
      row({ id: 'b', count: 9 }),
      row({ id: 'c', count: 100 }),
    ];
    expect(ids(sortRows(rows, desc('count'), columns))).toEqual(['c', 'a', 'b']);
  });

  it('orders strings case-insensitively', () => {
    const rows = [row({ id: 'a', name: 'beta' }), row({ id: 'b', name: 'Alpha' })];
    expect(ids(sortRows(rows, asc('name'), columns))).toEqual(['b', 'a']);
  });

  // "Item 10" after "Item 9" is what a person expects of a ticket list; plain
  // lexical order puts it after "Item 1" instead.
  it('orders embedded numbers naturally', () => {
    const rows = [
      row({ id: 'a', name: 'Item 10' }),
      row({ id: 'b', name: 'Item 9' }),
      row({ id: 'c', name: 'Item 1' }),
    ];
    expect(ids(sortRows(rows, asc('name'), columns))).toEqual(['c', 'b', 'a']);
  });

  it('orders false before true', () => {
    const rows = [row({ id: 'a', done: true }), row({ id: 'b', done: false })];
    expect(ids(sortRows(rows, asc('done'), columns))).toEqual(['b', 'a']);
  });

  it('orders Dates chronologically', () => {
    const rows = [
      row({ id: 'a', at: new Date('2026-07-30') }),
      row({ id: 'b', at: new Date('2026-01-01') }),
    ];
    expect(ids(sortRows(rows, asc('at'), columns))).toEqual(['b', 'a']);
  });
});

describe('sortRows — missing values', () => {
  // Sorting a mostly-empty column descending must not hand back a screenful
  // of blanks. Empties are pushed to the end in BOTH directions, which is the
  // one place this comparator deliberately breaks asc/desc symmetry.
  it('sorts null and undefined last when ascending', () => {
    const rows = [
      row({ id: 'a', note: null }),
      row({ id: 'b', note: 'zulu' }),
      row({ id: 'c' }),
      row({ id: 'd', note: 'alpha' }),
    ];
    expect(ids(sortRows(rows, asc('note'), columns))).toEqual(['d', 'b', 'a', 'c']);
  });

  it('still sorts them last when descending', () => {
    const rows = [
      row({ id: 'a', note: null }),
      row({ id: 'b', note: 'zulu' }),
      row({ id: 'c' }),
      row({ id: 'd', note: 'alpha' }),
    ];
    expect(ids(sortRows(rows, desc('note'), columns))).toEqual(['b', 'd', 'a', 'c']);
  });

  // NaN compares false against everything, so left in the numeric branch it
  // makes the result depend on the input order the engine happened to see.
  it('treats NaN as missing rather than letting it randomize the order', () => {
    const rows = [
      row({ id: 'a', count: NaN }),
      row({ id: 'b', count: 2 }),
      row({ id: 'c', count: 1 }),
    ];
    expect(ids(sortRows(rows, asc('count'), columns))).toEqual(['c', 'b', 'a']);
  });

  // An empty string is a VALUE, not an absence — a row whose title is "" is
  // not the same as a row with no title column at all.
  it('treats an empty string as a value, not a missing one', () => {
    const rows = [
      row({ id: 'a', note: 'b' }),
      row({ id: 'b', note: null }),
      row({ id: 'c', note: '' }),
    ];
    expect(ids(sortRows(rows, asc('note'), columns))).toEqual(['c', 'a', 'b']);
  });
});

describe('sortRows — multi-key', () => {
  // Shift-click already produces a multi-key SortBy[]; before this, the
  // ordinals the header renders described an ordering nothing implemented.
  it('honours every key in order, not just the first', () => {
    const rows = [
      row({ id: 'a', name: 'x', count: 2 }),
      row({ id: 'b', name: 'x', count: 1 }),
      row({ id: 'c', name: 'a', count: 5 }),
    ];
    const sort: SortBy[] = [
      { field: 'name', direction: 'asc' },
      { field: 'count', direction: 'asc' },
    ];
    expect(ids(sortRows(rows, sort, columns))).toEqual(['c', 'b', 'a']);
  });

  it('gives each key its own direction', () => {
    const rows = [
      row({ id: 'a', name: 'x', count: 2 }),
      row({ id: 'b', name: 'x', count: 1 }),
      row({ id: 'c', name: 'a', count: 5 }),
    ];
    const sort: SortBy[] = [
      { field: 'name', direction: 'asc' },
      { field: 'count', direction: 'desc' },
    ];
    expect(ids(sortRows(rows, sort, columns))).toEqual(['c', 'a', 'b']);
  });

  it('falls through to a later key only when the earlier ones tie', () => {
    const rows = [row({ id: 'a', name: 'b', count: 1 }), row({ id: 'b', name: 'a', count: 9 })];
    const sort: SortBy[] = [
      { field: 'name', direction: 'asc' },
      { field: 'count', direction: 'asc' },
    ];
    expect(ids(sortRows(rows, sort, columns))).toEqual(['b', 'a']);
  });
});

describe('sortRows — stability and identity', () => {
  it('keeps tied rows in their original order', () => {
    const rows = ['a', 'b', 'c', 'd'].map((id) => row({ id, name: 'same' }));
    expect(ids(sortRows(rows, asc('name'), columns))).toEqual(['a', 'b', 'c', 'd']);
  });

  // Descending must reverse the KEY, not the tie-break — otherwise every
  // equal run flips as a side effect of the direction.
  it('keeps tied rows in their original order when descending too', () => {
    const rows = ['a', 'b', 'c', 'd'].map((id) => row({ id, name: 'same' }));
    expect(ids(sortRows(rows, desc('name'), columns))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not mutate the array it was given', () => {
    const rows = [row({ id: 'a', count: 2 }), row({ id: 'b', count: 1 })];
    sortRows(rows, asc('count'), columns);
    expect(ids(rows)).toEqual(['a', 'b']);
  });

  // Returning the SAME array when there is nothing to do is what lets a
  // caller pass the result straight into a memo without re-rendering on
  // every keystroke elsewhere on the screen.
  it('returns the original array when there is no sort', () => {
    const rows = [row({ id: 'a' })];
    expect(sortRows(rows, [], columns)).toBe(rows);
  });

  it('returns the original array when no sorted field maps to a column', () => {
    const rows = [row({ id: 'a' })];
    expect(sortRows(rows, asc('nope'), columns)).toBe(rows);
  });

  // A column that only has `render` cannot say what a row's value IS, so it
  // is skipped rather than compared as `undefined` — which would flatten the
  // whole table into one tie.
  it('ignores a sort on a column with no value accessor', () => {
    const rows = [row({ id: 'a' })];
    expect(sortRows(rows, asc('rendered'), columns)).toBe(rows);
  });

  it('skips an unmappable key but still applies the ones that map', () => {
    const rows = [row({ id: 'a', count: 2 }), row({ id: 'b', count: 1 })];
    const sort: SortBy[] = [
      { field: 'nope', direction: 'asc' },
      { field: 'count', direction: 'asc' },
    ];
    expect(ids(sortRows(rows, sort, columns))).toEqual(['b', 'a']);
  });
});
