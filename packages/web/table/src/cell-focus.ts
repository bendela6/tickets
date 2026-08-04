import type { CellRef } from './types';

/** What the grid looks like right now, from the mover's point of view. */
export interface FocusGeometry {
  /** Visible column keys, left to right. Hidden columns are never in here —
   *  hiding is done by the caller filtering `columns`, so "arrows skip hidden
   *  columns" needs no code, only this list. */
  columnKeys: string[];
  /** Number of DATA rows. Group header bands are not addressable. */
  rowCount: number;
  /** Rows a PageUp/PageDown moves. One viewport's worth. */
  pageSize: number;
}

/** The parts of a keyboard event this cares about. Taking a plain object
 *  rather than a KeyboardEvent keeps the mover pure and testable without a
 *  DOM. */
export interface FocusKey {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** `rowIndex: -1` is the header row, which is why the floor is -1 and not 0. */
const HEADER_ROW = -1;

function clampRow(row: number, rowCount: number): number {
  if (row < HEADER_ROW) return HEADER_ROW;
  if (row > rowCount - 1) return Math.max(HEADER_ROW, rowCount - 1);
  return row;
}

/**
 * Where a key press moves the focused cell. Returns `null` when the key is
 * not a movement key, which is the signal to let the browser have it —
 * `Tab` above all, since the grid is a single tab stop and trapping it would
 * make a 10-column table a keyboard trap.
 *
 * Pure on purpose. The hard parts of the focus model are the DOM ones
 * (scrolling a virtualized row into view before focusing it, parking focus
 * when the row unmounts); keeping the arithmetic out of that means the
 * keyboard map can be verified without any of it.
 */
export function nextCell(
  current: CellRef,
  event: FocusKey,
  geometry: FocusGeometry,
): CellRef | null {
  const { columnKeys, rowCount, pageSize } = geometry;
  if (columnKeys.length === 0) {
    return null;
  }

  const col = Math.max(0, columnKeys.indexOf(current.columnKey));
  const lastCol = columnKeys.length - 1;
  const lastRow = Math.max(HEADER_ROW, rowCount - 1);
  const at = (rowIndex: number, colIndex: number): CellRef => ({
    rowIndex,
    columnKey: columnKeys[colIndex] as string,
  });
  const jump = event.ctrlKey || event.metaKey;

  switch (event.key) {
    case 'ArrowLeft':
      return at(current.rowIndex, Math.max(0, col - 1));
    case 'ArrowRight':
      return at(current.rowIndex, Math.min(lastCol, col + 1));
    // Up from row 0 reaches the header row rather than dead-ending, which is
    // what makes sorting keyboard-reachable at all.
    case 'ArrowUp':
      return at(clampRow(current.rowIndex - 1, rowCount), col);
    case 'ArrowDown':
      return at(clampRow(current.rowIndex + 1, rowCount), col);
    // PageUp stops at the first DATA row: the header is one step above row 0
    // and should not be reachable by a blind viewport jump.
    case 'PageUp':
      return at(Math.max(0, current.rowIndex - pageSize), col);
    case 'PageDown':
      return at(clampRow(current.rowIndex + pageSize, rowCount), col);
    case 'Home':
      return jump ? at(Math.min(0, lastRow), 0) : at(current.rowIndex, 0);
    case 'End':
      return jump ? at(lastRow, lastCol) : at(current.rowIndex, lastCol);
    default:
      return null;
  }
}
