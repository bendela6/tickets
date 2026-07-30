/**
 * Horizontal and vertical metrics shared by every row-shaped slot in this
 * render set, taken from the spec of record — docs/design/03-project-board.html
 * lines 128 (header) and 132 (body row). Those are the same numbers the
 * project board's Table view implements by hand, so a table built from this
 * adapter lines up column-for-column with the board.
 *
 * The header, every body row and the loading skeleton lay out on one shared
 * `gridTemplateColumns`. Their padding therefore has to agree exactly, or the
 * header labels drift out of alignment with the cells beneath them. Declaring
 * the values once here is what makes that drift impossible.
 */

/**
 * Inset on the row itself, outside the column tracks. Because it shifts every
 * track, the header row, body rows and skeleton rows must all carry it — a row
 * that omits it is offset from the rest of the table by 4px.
 */
export const ROW_INSET = 'px-1';

/**
 * Fixed header height. Fixed rather than derived from the header cells'
 * padding so the sticky header stays 36px regardless of what a caller renders
 * into a header — an icon or a taller control in one column must not make the
 * whole header grow.
 */
export const HEAD_HEIGHT = 'h-9';

/**
 * Per-cell gutter. The leading column is roomier than the rest, which puts
 * 16px of air at the table's left edge (4px inset + 12px) while keeping
 * adjacent columns 16px apart (8px + 8px).
 *
 * Takes the column's position rather than the column itself: "am I the first
 * column?" is a question about the table's edge, not about the column's own
 * identity, and `column.key` cannot answer it.
 */
export function cellGutter(index: number): string {
  return index === 0 ? 'px-3' : 'px-2';
}

/** The two row densities the design defines. */
export type Density = 'comfortable' | 'compact';

/**
 * Row heights in pixels, per docs/design/02-all-tickets.html line 137 and
 * 03-project-board.html line 132 (42px), with the board's compact rung at 32px.
 *
 * These are pixel numbers rather than Tailwind classes because the virtualizer
 * needs the height up front to position rows — it cannot read a class. That is
 * exactly why they belong here: a caller passing a raw `42` to `rowHeight` is
 * writing a design value at a call site, which is the one thing the rest of
 * this module exists to prevent.
 */
export const ROW_HEIGHT: Record<Density, number> = {
  comfortable: 42,
  compact: 32,
};

/** `rowHeight={rowHeightFor(density)}` — the intended way to feed the engine. */
export function rowHeightFor(density: Density): number {
  return ROW_HEIGHT[density];
}

/**
 * The focused cell's ring.
 *
 * The house idiom is `focus-visible:ring-3`, and it is WRONG here: a 3px soft
 * ring drawn outside the box bleeds over the neighbouring cell in a dense
 * grid, so the focused cell and the one beside it both look half-selected.
 *
 * `tokens.css:1094` already establishes the right shape for a rectangular
 * selection — the rich-text node outline, 2px indigo at `outline-offset: 1px`.
 * Cells take the same colour and weight at offset **-2**, so the ring sits
 * INSET and cannot overlap an adjacent cell or the row's bottom border.
 *
 * This is a plain outline rather than a `focus-visible` variant on purpose:
 * the grid's focus is a MODEL, not a browser heuristic. The engine says which
 * cell is focused via `RenderTdCtx.focused`, and arrow-key navigation must
 * draw the ring whether or not the browser considers the interaction
 * keyboard-driven.
 */
export const CELL_FOCUS_RING = 'outline-2 -outline-offset-2 outline-indigo-9';

/**
 * A pinned cell. `position: sticky` on the CELL, with the offset supplied by
 * the engine — we lay out on one CSS Grid, so a frozen column keeps its track
 * in the template rather than the table splitting into panes.
 *
 * `bg-inherit` is the load-bearing part: a pinned cell must be opaque or the
 * rows sliding under it show through, and inheriting is the only way for it to
 * follow the row's hover and selected tints instead of freezing one colour.
 * It is why `renderTr` takes an opaque background whenever a column is pinned.
 *
 * `z-10` puts it over the scrolling cells but under the sticky header, which
 * is `z-10` on a row that comes first in the DOM.
 */
export const PINNED_CELL = 'sticky z-10 bg-inherit';

/**
 * The line between the frozen columns and the part that scrolls.
 *
 * Only the INNERMOST pinned column carries it — the engine marks that one —
 * so a table with three frozen columns gets one divider, not three.
 *
 * A hairline rather than a shadow: every `shadow-*` token here casts on all
 * four sides, which on a 32px row reads as a smudge above and below, and a
 * one-sided shadow can only be written as an arbitrary value, which this
 * project does not allow.
 */
export const PINNED_EDGE: Record<'left' | 'right', string> = {
  left: 'border-r-1 border-gray-6',
  right: 'border-l-1 border-gray-6',
};

/**
 * The scroll container's edge treatment, by how far it is scrolled.
 *
 * Same reasoning as `PINNED_EDGE`, and the same limitation: a directional
 * inset shadow — the classic scroll-shadow — needs an arbitrary value. This is
 * a hairline on whichever edge has content hidden past it, which carries the
 * same information: there is more table that way.
 */
export const SCROLL_EDGE: Record<'none' | 'start' | 'middle' | 'end', string> = {
  none: '',
  start: 'border-r-1 border-gray-6',
  middle: 'border-x-1 border-gray-6',
  end: 'border-l-1 border-gray-6',
};
