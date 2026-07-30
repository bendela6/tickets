import { useState } from 'react';
import { useTableWidths } from './use-table-widths';
import type { CellRef, SortBy, TableState } from './types';

export interface UseTableOptions {
  initialSort?: SortBy[];
  /** Persist column widths under this id. Omit and they live only as long as
   *  the component — see `useTableWidths`. */
  widthsId?: string;
  initialCollapsed?: string[];
}

export interface UseTableResult {
  state: TableState;
  onSortChange: (next: SortBy[]) => void;
  onWidthChange: (key: string, px: number) => void;
  onCollapseChange: (next: Set<string>) => void;
  onFocusChange: (next: CellRef | null) => void;
}

/**
 * Uncontrolled defaults for `TableState`, shaped to be spread straight onto
 * `<Table>`:
 *
 *     const table = useTable({ widthsId: 'all-items' });
 *     <Table {...table} columns={columns} rows={rows} … />
 *
 * `Table` stays fully controlled — this hook adds nothing the engine knows
 * about. It exists because every caller was otherwise writing the same three
 * `useState`s, and the third (widths) has a persistence rule that was being
 * re-derived each time.
 *
 * A caller that owns one of these fields — sort pushed into the URL, say —
 * keeps using the controlled props directly; spreading and then overriding
 * `state`/`onSortChange` works too, since these are ordinary props.
 */
export function useTable(opts: UseTableOptions = {}): UseTableResult {
  const [sort, setSort] = useState<SortBy[]>(() => opts.initialSort ?? []);
  const [widths, onWidthChange] = useTableWidths(opts.widthsId);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(opts.initialCollapsed));
  // Null, not the first cell: the ring must not appear until the user has put
  // focus somewhere. The engine still makes the first cell the TAB STOP, so
  // the grid is reachable — that is a separate question from where the ring is.
  const [focused, setFocused] = useState<CellRef | null>(null);

  return {
    state: { sort, widths, collapsed, focused },
    onSortChange: setSort,
    onWidthChange,
    onCollapseChange: setCollapsed,
    // Passing this to <Table> is what turns the cell focus model on.
    onFocusChange: setFocused,
  };
}
