import { describe, it, expect } from 'vitest';
import { nextCell, type FocusGeometry } from './cell-focus';
import type { CellRef } from './types';

const geometry: FocusGeometry = {
  columnKeys: ['a', 'b', 'c'],
  rowCount: 50,
  pageSize: 10,
};

const at = (rowIndex: number, columnKey: string): CellRef => ({ rowIndex, columnKey });
const move = (from: CellRef, key: string, mod?: 'ctrl' | 'meta', geo = geometry) =>
  nextCell(from, { key, ctrlKey: mod === 'ctrl', metaKey: mod === 'meta' }, geo);

describe('nextCell — arrows', () => {
  it('moves right one column', () => {
    expect(move(at(3, 'a'), 'ArrowRight')).toEqual(at(3, 'b'));
  });

  it('moves left one column', () => {
    expect(move(at(3, 'b'), 'ArrowLeft')).toEqual(at(3, 'a'));
  });

  it('stops at the first column', () => {
    expect(move(at(3, 'a'), 'ArrowLeft')).toEqual(at(3, 'a'));
  });

  it('stops at the last column', () => {
    expect(move(at(3, 'c'), 'ArrowRight')).toEqual(at(3, 'c'));
  });

  it('moves down one row', () => {
    expect(move(at(3, 'b'), 'ArrowDown')).toEqual(at(4, 'b'));
  });

  it('stops at the last row', () => {
    expect(move(at(49, 'b'), 'ArrowDown')).toEqual(at(49, 'b'));
  });
});

describe('nextCell — the header row', () => {
  // Without this, a keyboard user can never reach the sort controls: the
  // header is not a data row, so nothing else navigates to it.
  it('reaches the header row from row 0', () => {
    expect(move(at(0, 'b'), 'ArrowUp')).toEqual(at(-1, 'b'));
  });

  it('goes no further up than the header', () => {
    expect(move(at(-1, 'b'), 'ArrowUp')).toEqual(at(-1, 'b'));
  });

  it('comes back down into the first data row', () => {
    expect(move(at(-1, 'b'), 'ArrowDown')).toEqual(at(0, 'b'));
  });

  it('moves along the header row like any other', () => {
    expect(move(at(-1, 'a'), 'ArrowRight')).toEqual(at(-1, 'b'));
  });

  it('stays on the header when there are no data rows at all', () => {
    const empty = { ...geometry, rowCount: 0 };
    expect(move(at(-1, 'b'), 'ArrowDown', undefined, empty)).toEqual(at(-1, 'b'));
  });
});

describe('nextCell — jumps', () => {
  it('goes to the first cell in the row on Home', () => {
    expect(move(at(3, 'c'), 'Home')).toEqual(at(3, 'a'));
  });

  it('goes to the last cell in the row on End', () => {
    expect(move(at(3, 'a'), 'End')).toEqual(at(3, 'c'));
  });

  it('goes to the first cell in the table on Ctrl+Home', () => {
    expect(move(at(30, 'c'), 'Home', 'ctrl')).toEqual(at(0, 'a'));
  });

  it('goes to the last cell in the table on Ctrl+End', () => {
    expect(move(at(3, 'a'), 'End', 'ctrl')).toEqual(at(49, 'c'));
  });

  // A Mac keyboard sends metaKey, not ctrlKey.
  it('treats Cmd like Ctrl', () => {
    expect(move(at(3, 'a'), 'End', 'meta')).toEqual(at(49, 'c'));
  });

  it('moves a viewport on PageDown', () => {
    expect(move(at(3, 'b'), 'PageDown')).toEqual(at(13, 'b'));
  });

  it('moves a viewport on PageUp', () => {
    expect(move(at(30, 'b'), 'PageUp')).toEqual(at(20, 'b'));
  });

  it('clamps PageDown to the last row', () => {
    expect(move(at(45, 'b'), 'PageDown')).toEqual(at(49, 'b'));
  });

  // PageUp lands on the first DATA row. The header sits one step above row 0
  // and should not be reached by a blind viewport jump.
  it('clamps PageUp to the first row, not the header', () => {
    expect(move(at(5, 'b'), 'PageUp')).toEqual(at(0, 'b'));
  });
});

describe('nextCell — non-movement keys', () => {
  // Returning null is the signal to let the browser have the key. Tab above
  // all: the grid is one tab stop, and swallowing Tab would turn a table of
  // 10 columns over 1,000 rows into a keyboard trap.
  it('does not handle Tab', () => {
    expect(move(at(3, 'b'), 'Tab')).toBeNull();
  });

  it.each(['Enter', 'F2', 'Escape', ' ', 'a'])('does not handle %s', (key) => {
    expect(move(at(3, 'b'), key)).toBeNull();
  });

  it('does nothing when there are no columns', () => {
    expect(move(at(3, 'b'), 'ArrowRight', undefined, { ...geometry, columnKeys: [] })).toBeNull();
  });

  // A column that has just been hidden is no longer in `columnKeys`, so the
  // focused key does not resolve. Falling back to the first column keeps the
  // grid navigable instead of stranding focus on a column that is gone.
  it('recovers from a column key that no longer exists', () => {
    expect(move(at(3, 'gone'), 'ArrowRight')).toEqual(at(3, 'b'));
  });
});
