import type { RenderTheadCtx } from '@bh/table';
import { cn } from '../../../style';
import { COLUMN_TRACKS, HEAD_HEIGHT, HEAD_SURFACE, ROW_INSET } from './metrics';

export function renderThead({ children, refreshing, filterRow }: RenderTheadCtx) {
  const headerRow = (
    <div
      role="row"
      // Row 1 of the grid. `aria-rowindex` is 1-based and counts the header,
      // which is what makes the data rows start at 2.
      aria-rowindex={1}
      // Deliberately no `items-center`: the header cells stretch to the full
      // 36px and centre their own labels instead. A column's resize handle is
      // absolutely positioned against its cell, so a cell that shrank to its
      // label's height would leave a 13px-tall drag target.
      className={cn(
        // `relative` for the refresh line, which is drawn ON the header's
        // bottom rule rather than above or below it.
        //
        // Sticky on its own only when it IS the whole header. With a filter
        // row under it, the box around both is what sticks.
        'grid w-full border-b-1',
        filterRow === undefined && 'sticky top-0 z-10',
        refreshing && 'relative',
        HEAD_SURFACE,
        // Between the labels and the filters the rule steps down a rung: the
        // two bands are one header, and the `gray-7` rule belongs under the
        // whole of it, which the filter row draws.
        filterRow !== undefined && 'border-b-gray-6',
        HEAD_HEIGHT,
        ROW_INSET,
      )}
      style={COLUMN_TRACKS}
    >
      {children}
      {/* Refreshing: a 2px line along the rule the header already has, an
          indigo-3 track with an indigo-9 segment travelling across it.
          Indeterminate on purpose — a request in flight has no percentage, and
          a bar that pretends otherwise is a lie that has to be walked back.

          `-bottom-1` puts it over the 1px border rather than beside it, so the
          header does not grow by two pixels and shift every row down when a
          refresh starts. That is the whole promise of this state: nothing
          moves. */}
      {refreshing ? (
        <span
          aria-hidden
          data-slot="table-refresh"
          className="bg-indigo-3 absolute -bottom-1 left-0 z-1 h-2 w-full overflow-hidden"
        >
          <span className="bg-indigo-9 table-refresh-segment block h-full w-1/5" />
        </span>
      ) : null}
    </div>
  );
  if (filterRow === undefined) {
    return headerRow;
  }
  // One sticky box around both rows, so the filter row sticks with the labels
  // without either of them having to know how tall the other is. A rowgroup,
  // because a grid may own rows and rowgroups and nothing else.
  return (
    <div role="rowgroup" className="sticky top-0 z-10">
      {headerRow}
      {filterRow}
    </div>
  );
}
