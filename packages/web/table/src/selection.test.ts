import { describe, it, expect } from 'vitest';
import {
  extendSelection,
  rangeBetween,
  selectionOf,
  toggleAll,
  toggleSelection,
} from './selection';

const set = (...ids: string[]) => new Set(ids);
const sorted = (s: Set<string>) => [...s].sort();

describe('toggleSelection', () => {
  it('adds a row that was not selected', () => {
    expect(sorted(toggleSelection(set('a'), 'b'))).toEqual(['a', 'b']);
  });

  it('removes a row that was', () => {
    expect(sorted(toggleSelection(set('a', 'b'), 'b'))).toEqual(['a']);
  });

  it('does not mutate the set it was given', () => {
    const before = set('a');
    toggleSelection(before, 'b');
    expect(sorted(before)).toEqual(['a']);
  });
});

describe('extendSelection', () => {
  // Shift-click ADDS. A range that toggled each row would punch holes in an
  // existing selection, which is not what dragging a range means.
  it('adds every id in the run', () => {
    expect(sorted(extendSelection(set(), ['a', 'b', 'c']))).toEqual(['a', 'b', 'c']);
  });

  it('never removes a row already in the selection', () => {
    expect(sorted(extendSelection(set('b'), ['a', 'b', 'c']))).toEqual(['a', 'b', 'c']);
  });

  it('leaves rows outside the run alone', () => {
    expect(sorted(extendSelection(set('z'), ['a']))).toEqual(['a', 'z']);
  });
});

describe('toggleAll', () => {
  it('selects everything when nothing is selected', () => {
    expect(sorted(toggleAll(set(), ['a', 'b']))).toEqual(['a', 'b']);
  });

  it('clears when everything is selected', () => {
    expect(sorted(toggleAll(set('a', 'b'), ['a', 'b']))).toEqual([]);
  });

  // A half-selected table's header completes the selection rather than
  // throwing it away — losing a partial selection to one stray click is the
  // one outcome that cannot be undone by clicking again.
  it('completes a partial selection rather than clearing it', () => {
    expect(sorted(toggleAll(set('a'), ['a', 'b']))).toEqual(['a', 'b']);
  });

  it('leaves rows the table does not have alone', () => {
    expect(sorted(toggleAll(set('z', 'a', 'b'), ['a', 'b']))).toEqual(['z']);
  });
});

describe('selectionOf', () => {
  it('reports none', () => {
    expect(selectionOf(set(), ['a', 'b'])).toEqual({ checked: false, indeterminate: false });
  });

  it('reports some as indeterminate', () => {
    expect(selectionOf(set('a'), ['a', 'b'])).toEqual({ checked: false, indeterminate: true });
  });

  it('reports all as checked', () => {
    expect(selectionOf(set('a', 'b'), ['a', 'b'])).toEqual({ checked: true, indeterminate: false });
  });

  it('reports an empty table as neither', () => {
    expect(selectionOf(set('a'), [])).toEqual({ checked: false, indeterminate: false });
  });
});

describe('rangeBetween', () => {
  it('is inclusive at both ends', () => {
    expect(rangeBetween(2, 5)).toEqual([2, 3, 4, 5]);
  });

  // Shift-clicking upwards has to select the same rows as shift-clicking down.
  it('reads the same in either direction', () => {
    expect(rangeBetween(5, 2)).toEqual([2, 3, 4, 5]);
  });

  it('is a single row when both ends are the same', () => {
    expect(rangeBetween(3, 3)).toEqual([3]);
  });
});
