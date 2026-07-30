import { useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { nextCell, type FocusGeometry } from './cell-focus';
import { restoreTabStops, suppressTabStops } from './tab-stops';
import type { CellFocusProps, CellRef } from './types';

const HEADER_ROW = -1;

/** What counts as "a widget the user can step into". Same list the tab-stop
 *  suppressor uses, because the two have to agree on what a widget is. */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';

/**
 * The engine's only handle on a cell it did not render. Looked up by ADDRESS
 * rather than held as a ref: virtualization unmounts the row, so any ref the
 * adapter handed back would be stale by the time it mattered.
 */
function findCell(root: HTMLElement, ref: CellRef): HTMLElement | null {
  // The row index goes in the selector (it is a number, so it cannot need
  // escaping); the column key is compared in JS, because a caller's key is
  // arbitrary text and CSS.escape is not worth depending on.
  for (const el of root.querySelectorAll<HTMLElement>(`[data-cell-row="${ref.rowIndex}"]`)) {
    if (el.getAttribute('data-cell-col') === ref.columnKey) {
      return el;
    }
  }
  return null;
}

export interface UseCellFocusOptions {
  scrollEl: HTMLElement | null;
  /** Off unless the caller supplied `onFocusChange`. A table that has not
   *  opted in keeps whatever tab behaviour its cell content already had —
   *  turning the roving tabindex on unasked would make every link and button
   *  in the table unreachable by Tab. */
  enabled: boolean;
  focused: CellRef | null | undefined;
  onFocusChange?: (next: CellRef | null) => void;
  geometry: FocusGeometry;
  /** Bring a row into view. Called BEFORE focus moves — see below. */
  scrollRowIntoView: (rowIndex: number) => void;
  /** Enter on a cell that holds no widget. */
  onActivate?: (rowIndex: number) => void;
}

export interface CellFocusApi {
  onKeyDown: (e: KeyboardEvent) => void;
  onFocusCapture: (e: FocusEvent) => void;
  onBlurCapture: (e: FocusEvent) => void;
  /** Draw the ring? True only once the user has actually focused something. */
  isFocused: (rowIndex: number, columnKey: string) => boolean;
  focusPropsFor: (rowIndex: number, columnKey: string) => CellFocusProps;
}

/**
 * Roving `tabindex` cell focus, with the two mitigations virtualization
 * forces (see the design's "Cell focus model"):
 *
 * 1. Keyboard movement scrolls the target into view BEFORE focusing it. A row
 *    that is off-screen has no DOM node at all, so focusing first would land
 *    on nothing and drop focus to `<body>`.
 * 2. When the user mouse-scrolls the focused row away, DOM focus is parked on
 *    the scroll container while the logical `CellRef` is kept, and real focus
 *    is restored the moment the row remounts.
 *
 * Two modes, because cells hold real widgets and arrows cannot mean both
 * "next cell" and "next item in this dropdown":
 *
 * - Navigation (default) — arrows move between cells, the grid is ONE tab
 *   stop, every widget inside a cell is pushed out of the tab order.
 * - Interaction — `Enter`/`F2` moves real focus into the cell's first
 *   focusable child and hands the arrows to it. `Escape` comes back.
 */
export function useCellFocus(opts: UseCellFocusOptions): CellFocusApi {
  const { scrollEl, enabled, focused, onFocusChange, geometry, scrollRowIntoView, onActivate } =
    opts;
  const [interacting, setInteracting] = useState(false);
  /** Does the grid currently own DOM focus? Kept in a ref rather than state
   *  because it must be readable inside the layout effect without causing the
   *  render that would read it. */
  const owns = useRef(false);

  /** The cell that carries `tabindex="0"`. Falls back to the first cell so
   *  the grid is reachable by Tab before anything has ever been focused —
   *  a grid where EVERY cell is `-1` cannot be entered at all. Distinct from
   *  `isFocused`, which drives the ring and stays false until the user has
   *  actually put focus somewhere. */
  const tabStop: CellRef = focused ?? {
    rowIndex: geometry.rowCount > 0 ? 0 : HEADER_ROW,
    columnKey: geometry.columnKeys[0] ?? '',
  };

  // Runs on EVERY render, deliberately: a mouse scroll re-renders through the
  // virtualizer without changing `focused`, and that is exactly the moment the
  // focused row may have unmounted.
  useLayoutEffect(() => {
    if (!scrollEl || !enabled) {
      return;
    }
    const active = document.activeElement;
    const target = focused ? findCell(scrollEl, focused) : null;

    suppressTabStops(scrollEl, interacting ? target : null);

    if (!owns.current) {
      return;
    }
    if (target) {
      // Never yank focus off a widget the user has stepped into.
      if (target !== active && !target.contains(active)) {
        target.focus({ preventScroll: true });
      }
    } else if (active === scrollEl || active === document.body || scrollEl.contains(active)) {
      scrollEl.focus({ preventScroll: true });
    }
  });

  // Leave no `tabindex="-1"` behind on unmount: the attributes are written
  // directly, so React will not clean them up.
  useLayoutEffect(() => {
    if (!scrollEl) {
      return;
    }
    return () => restoreTabStops(scrollEl);
  }, [scrollEl]);

  const refAt = (cell: HTMLElement): CellRef => ({
    rowIndex: Number(cell.getAttribute('data-cell-row')),
    columnKey: cell.getAttribute('data-cell-col') ?? '',
  });

  const same = (a: CellRef, b: CellRef | null | undefined) =>
    b != null && a.rowIndex === b.rowIndex && a.columnKey === b.columnKey;

  const onFocusCapture = (e: FocusEvent) => {
    if (!enabled) {
      return;
    }
    owns.current = true;
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-cell-row]');
    if (!cell) {
      return;
    }
    // Focus landing on a widget INSIDE a cell is interaction mode however the
    // user got there — clicking a row's Edit button counts.
    setInteracting(e.target !== cell);
    const ref = refAt(cell);
    if (!same(ref, focused)) {
      onFocusChange?.(ref);
    }
  };

  const onBlurCapture = (e: FocusEvent) => {
    if (!enabled) {
      return;
    }
    // `relatedTarget` is null when the element merely unmounted — a
    // virtualized row scrolling away. That is not the user leaving, so the
    // grid keeps claiming focus and the layout effect parks it.
    if (e.relatedTarget && !scrollEl?.contains(e.relatedTarget as Node)) {
      owns.current = false;
      setInteracting(false);
    }
  };

  const enterCell = (ref: CellRef, viaEnter: boolean, shiftKey: boolean) => {
    const cell = scrollEl ? findCell(scrollEl, ref) : null;
    const widget = cell?.querySelector<HTMLElement>(FOCUSABLE) ?? null;

    // Enter on a HEADER cell sorts in ONE keystroke. Stepping in and pressing
    // Enter again would also work, but the header row is addressable
    // precisely so that sorting is keyboard-reachable, and two keystrokes is
    // not that. The synthesized click carries shiftKey, so Shift+Enter still
    // adds a second sort key exactly as shift-click does.
    //
    // Falls back to the cell itself: a render set may put the sort handler on
    // a button INSIDE the header cell (the styled adapter does) or on the
    // header cell element itself, and both have to sort.
    if (viaEnter && ref.rowIndex === HEADER_ROW && cell) {
      (widget ?? cell).dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey }),
      );
      return;
    }
    if (widget && cell && scrollEl) {
      // Give this cell's widgets their tab order back before stepping in, so
      // a cell holding three buttons can be walked with Tab.
      suppressTabStops(scrollEl, cell);
      widget.focus({ preventScroll: true });
      setInteracting(true);
      return;
    }
    if (ref.rowIndex >= 0) {
      onActivate?.(ref.rowIndex);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!enabled || !scrollEl) {
      return;
    }

    if (interacting) {
      // Arrows belong to the widget in here. Only Escape gets out — and it is
      // stopped from propagating so it does not also close a surrounding
      // dialog on the way.
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setInteracting(false);
        (focused ? findCell(scrollEl, focused) : null)?.focus({ preventScroll: true });
      }
      return;
    }

    // The grid is one tab stop. Swallowing Tab is what would make a table of
    // ten columns over a thousand rows a keyboard trap.
    if (e.key === 'Tab') {
      return;
    }

    const current = focused ?? tabStop;

    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      enterCell(current, e.key === 'Enter', e.shiftKey);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      const cell = findCell(scrollEl, current);
      if (cell) {
        e.preventDefault();
        void navigator.clipboard?.writeText(cell.textContent ?? '');
      }
      return;
    }

    const next = nextCell(current, e, geometry);
    if (!next) {
      return;
    }
    e.preventDefault();
    // Order matters: scroll, THEN focus. Reversed, the target row may not be
    // mounted yet and the focus call lands on nothing.
    scrollRowIntoView(next.rowIndex);
    owns.current = true;
    if (!same(next, focused)) {
      onFocusChange?.(next);
    }
  };

  return {
    onKeyDown,
    onFocusCapture,
    onBlurCapture,
    isFocused: (rowIndex, columnKey) =>
      enabled &&
      focused != null &&
      focused.rowIndex === rowIndex &&
      focused.columnKey === columnKey,
    focusPropsFor: (rowIndex, columnKey) => ({
      ...(enabled
        ? { tabIndex: tabStop.rowIndex === rowIndex && tabStop.columnKey === columnKey ? 0 : -1 }
        : {}),
      'data-cell-row': rowIndex,
      'data-cell-col': columnKey,
    }),
  };
}
