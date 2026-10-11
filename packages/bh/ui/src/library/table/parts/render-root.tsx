import type { RenderRootCtx } from '@bh/table';
import { COLUMN_TRACKS_VAR } from './metrics';

export function renderRoot({ children, gridTemplate, rowCount, colCount }: RenderRootCtx) {
  // `role="grid"` is the legal parent ARIA requires for the descendant
  // `row`/`rowgroup`/`columnheader`/`cell` roles below — without it those
  // roles have no table ancestor and the sorted/resizable header row has no
  // legal parent at all. `grid` rather than `table`: rows are clickable and
  // columns are sortable and resizable, i.e. interactive.
  // `border-x` closes the grid at its outer edges — `cellDivider` rules
  // BETWEEN columns, which leaves the leading column's left and the trailing
  // column's right open, and a ruled table that stops short of its own edges
  // reads as unfinished.
  //
  // It goes here rather than on the cells for the reason cellDivider explains:
  // a cell is told its `index`, never the column count, so no cell can know it
  // is the last one. The root does — it IS the whole table. And it goes on the
  // root rather than the scroll container because this frame belongs to the
  // grid's content: when the table is wider than its viewport the left edge
  // should scroll away with column one, not hang in place over it. The
  // container's own edges are the scroll hint (`SCROLL_EDGE`), which is a
  // different statement — "there is more this way", not "the table ends here".
  return (
    <div
      role="grid"
      // The true size, not the mounted size. Without these a virtualized grid
      // tells a screen reader it holds however many rows happen to exist right
      // now — eighteen or so, whatever the real total.
      aria-rowcount={rowCount}
      aria-colcount={colCount}
      className="text-13/19 text-gray-12 w-full font-sans"
      // The one place the column tracks are written. Every row-shaped slot
      // below lays out on `var(--table-cols)`, so a resize mutates this one
      // attribute and nothing else — see COLUMN_TRACKS_VAR.
      style={{ [COLUMN_TRACKS_VAR]: gridTemplate }}
    >
      {children}
    </div>
  );
}
