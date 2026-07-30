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
