import type { RenderTrCtx } from '@tickets/table';
import { cn } from '../style';
import { ROW_INSET } from './metrics';

export function renderTr<T>({
  index,
  cells,
  gridTemplate,
  style,
  onClick,
  overlay,
}: RenderTrCtx<T>) {
  return (
    <div
      role="row"
      data-index={index}
      onClick={onClick}
      className={cn(
        // `group` is load-bearing: ActionsColumn reveals its buttons on
        // group-hover, so removing it silently hides every row action.
        'group grid items-center border-b-1 border-gray-6 transition-colors hover:bg-gray-1',
        ROW_INSET,
        onClick && 'cursor-pointer',
      )}
      // `right: auto` undoes the engine's stretched absolute positioning;
      // `width: 100%` then gives a flexible `1fr` track (e.g. all-items'
      // Title column) a definite basis to distribute free space against —
      // without it, `1fr` resolves against the row's own max-content
      // contribution and every row's Title track ends up a different width.
      // `minWidth: max-content` keeps fixed-px columns from being squeezed
      // narrower than their tracks, so the table still scrolls horizontally
      // when columns overflow the viewport.
      style={{
        ...style,
        right: 'auto',
        width: '100%',
        minWidth: 'max-content',
        gridTemplateColumns: gridTemplate,
      }}
    >
      {cells}
      {/* After the cells, so it paints over them. The row is already
          `position: absolute` from the virtualizer, so an absolutely
          positioned overlay resolves against this row.

          The `role="gridcell"` wrapper is not decoration: a `row` may own
          nothing but cells, and an unwrapped overlay made axe report a
          CRITICAL `aria-required-children` violation on every row. Row actions
          reading as a trailing cell is also the right answer for a keyboard
          user — they become reachable rather than invisible.

          `contents` is what makes that free. The wrapper generates no box, so
          an absolutely-positioned overlay still resolves against the row and
          an in-flow one still becomes a grid item — layout is identical to
          having no wrapper at all, which a plain `div` would not have been
          (it would have opened an implicit grid track). */}
      {overlay ? (
        <div role="gridcell" className="contents">
          {overlay}
        </div>
      ) : null}
    </div>
  );
}
