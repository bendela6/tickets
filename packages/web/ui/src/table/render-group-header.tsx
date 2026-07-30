import type { RenderGroupHeaderCtx } from '@tickets/table';

/**
 * A group's banner row. It does NOT take the column grid template: the header
 * is one continuous band, not a set of cells, so laying it out on the columns
 * would clip its content at the first column boundary.
 *
 * `role="row"` keeps the rowgroup's children uniform — a bare div between rows
 * makes the grid's accessibility tree invalid.
 *
 * The band's content then sits inside a `role="gridcell"` rather than directly
 * in the row. A `row` may only own cells, and axe reports a bare row as a
 * CRITICAL `aria-required-children` violation — which is how this was found.
 * No `aria-colspan`: the slot is handed a `gridTemplate` string, not a column
 * count, and `minmax(240px, 1fr)` cannot be counted by splitting on spaces.
 * The band reads as a one-cell row, which is honest.
 *
 * `px-4` is not an independent choice: it is the 16px the leading column's
 * content sits at (a row's 4px inset plus that column's 12px gutter — see
 * metrics.ts), so a group's label lines up with the keys beneath it.
 */
export function renderGroupHeader({ header, style }: RenderGroupHeaderCtx) {
  return (
    <div
      role="row"
      className="border-b-1 border-gray-6 bg-gray-1"
      style={{ ...style, right: 'auto', width: 'max-content', minWidth: '100%' }}
    >
      {/* `h-full` so the cell still fills the band the virtualizer sized, which
          is what keeps the label vertically centred now that the flex box is
          one level down. */}
      <div role="gridcell" className="flex h-full items-center gap-2.5 px-4">
        {header}
      </div>
    </div>
  );
}
