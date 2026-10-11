import { useState } from 'react';
import { useTableWidths } from './use-table-widths';
import type { CellRef, SortBy, TableState } from './types';

/** `useTable`'s options: where the table starts, and where it keeps its
 *  widths. */
export interface UseTableOptions {
  /** The sort to start with. Nothing sorts without it. */
  initialSort?: SortBy[];
  /** Persist column widths under `${storageKey}:widths`. The app names it
   *  (`shop:orders`), so two apps on one origin never share it. Omit and
   *  the widths live only as long as the component — see `useTableWidths`. */
  storageKey?: string;
  /** Keys of the groups to start collapsed. */
  initialCollapsed?: string[];
  /** Ids of the rows to start selected. */
  initialSelected?: string[];
}

/** What `useTable` returns: a `TableState` and a handler for each of its
 *  fields, named as `<Table>`'s props are, to spread onto it. */
export interface UseTableResult {
  /** The sort, widths, collapsed groups, focused cell and selection. */
  state: TableState;
  /** Records a new sort. */
  onSortChange: (next: SortBy[]) => void;
  /** Records a column's width, and saves it under the storage key. */
  onWidthChange: (key: string, px: number) => void;
  /** Records the collapsed groups. Passed to `<Table>`, it turns collapsing
   *  on. */
  onCollapseChange: (next: Set<string>) => void;
  /** Records the focused cell. Passed to `<Table>`, it turns the keyboard
   *  focus model on. */
  onFocusChange: (next: CellRef | null) => void;
  /** Records the selection. Passed to `<Table>` with `getRowId`, it turns
   *  selection on. */
  onSelectionChange: (next: Set<string>) => void;
}

// `Table` stays fully controlled — this hook adds nothing the engine knows
// about. It exists because every caller was otherwise writing the same three
// `useState`s, and the third (widths) has a persistence rule that was being
// re-derived each time.
/**
 * Holds a table's state for you: its sort, its widths (saved under
 * `storageKey`), its collapsed groups, its focused cell and its selection.
 * Spread what it returns onto `<Table>`:
 *
 *     const table = useTable({ storageKey: 'shop:orders' });
 *     <Table {...table} columns={columns} rows={rows} … />
 *
 * A caller that owns one of these fields — sort pushed into the URL, say —
 * passes its own `state` and handler after the spread; they are ordinary
 * props.
 *
 * @param opts Where the table starts, and the key its widths are saved under.
 */
export function useTable(opts: UseTableOptions = {}): UseTableResult {
  const [sort, setSort] = useState<SortBy[]>(() => opts.initialSort ?? []);
  const [widths, onWidthChange] = useTableWidths(opts.storageKey);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(opts.initialCollapsed));
  // Null, not the first cell: the ring must not appear until the user has put
  // focus somewhere. The engine still makes the first cell the TAB STOP, so
  // the grid is reachable — that is a separate question from where the ring is.
  const [focused, setFocused] = useState<CellRef | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(opts.initialSelected));

  return {
    state: { sort, widths, collapsed, focused, selected },
    onSortChange: setSort,
    onWidthChange,
    onCollapseChange: setCollapsed,
    // Passing this to <Table> is what turns the cell focus model on.
    onFocusChange: setFocused,
    // This plus `getRowId` is what turns row selection on.
    onSelectionChange: setSelected,
  };
}
