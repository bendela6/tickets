import type { RenderTrCtx } from '@bh/table';
import { cn } from '../../../style';
import { CELL_FOCUS_FILL_VAR, CELL_FOCUS_TOP_VAR, COLUMN_TRACKS, ROW_INSET } from './metrics';

export function renderTr<T>({
  index,
  ariaRowIndex,
  cells,
  style,
  onClick,
  overlay,
  selected,
  dimmed,
}: RenderTrCtx<T>) {
  // `hasPinned` is deliberately not read. It existed to make a row opaque only
  // when some column was frozen — a pinned cell is `bg-inherit`, and inheriting
  // a TRANSPARENT background let the rows scrolling under it show through. Now
  // that every row is `bg-surface-raised` there is always a real colour to
  // inherit, so the condition has nothing left to decide. The engine still
  // reports it, and a render set whose rows are not opaque would still need it.
  return (
    <div
      role="row"
      data-index={index}
      // The engine's number: this row's place in the whole data set, not in the
      // mounted window, counted past however many header rows sit above it —
      // one, or two with a filter row.
      aria-rowindex={ariaRowIndex}
      // Announced, not just tinted. A selected row that only differs by
      // background is invisible to a screen reader, and bulk actions are
      // exactly the thing you must be able to check before running.
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        // `group` is load-bearing: ActionsColumn reveals its buttons on
        // group-hover, so removing it silently hides every row action.
        //
        // Deliberately NOT `items-center` — the same call `renderThead` makes,
        // and for the same two reasons. A centred grid item shrink-wraps its
        // text, so a cell in a 42px row was a ~19px box floating in the middle
        // of it: its focus ring drew a thin band rather than the cell, and its
        // column divider stopped an arm's length short of the row above and
        // below. Stretched, a cell IS its track. Vertical centring does not go
        // away, it moves one level down, to the `items-center` each cell
        // already carries for its own content.
        // `relative` is load-bearing now: the row overlay is absolutely
        // positioned and used to resolve against the box the virtualizer had
        // already made `position: absolute`. In normal flow the row has to
        // establish that containing block itself, or hover actions fly off to
        // the nearest positioned ancestor.
        //
        // `bg-surface-raised` and not transparent: rows are the sheet the
        // table is made of, and the page behind them is a different, recessed
        // ground. A transparent row would let that ground show through and the
        // frame would enclose nothing. It is also what makes hovering to
        // `gray-1` read as a step DOWN from the surface rather than a tint
        // appearing out of nowhere.
        //
        // `w-full`, and emphatically NOT `min-w-max`. A row sized to
        // `max-content` makes the whole table as wide as its own widest cell —
        // and under virtualization only a dozen rows exist at a time, so the
        // table's width became a function of WHICH ROWS HAPPENED TO BE ON
        // SCREEN: scrolling swapped a long title in and every column jumped.
        // It was invisible while rows were absolutely positioned (out of flow,
        // contributing nothing to intrinsic width) and appeared the moment they
        // moved into normal flow. The track list is the only thing allowed to
        // decide column widths; tracks wider than the container overflow it,
        // which is what the scroll container scrolls.
        'group border-gray-6 bg-surface-raised hover:bg-gray-1 relative grid w-full border-b-1 transition-colors',
        ROW_INSET,
        onClick && 'cursor-pointer',
        // A tint one step past the hover state, so a selected row still
        // responds to hover instead of looking stuck.
        selected && 'bg-indigo-2 hover:bg-indigo-3',
        // Refreshing: the row stays exactly where it is and reads back one
        // step, so a number you are looking at cannot be mistaken for a fresh
        // one. Colour and not opacity — opacity would take the badges and
        // avatars down with it, and those are not stale, they are just there.
        dimmed && 'text-gray-11',
      )}
      // Just the height the engine sized the scroll region against, plus the
      // inherited tracks. The `right: auto` / `width: 100%` pair that used to
      // be here existed solely to undo a stretched absolute box; a row in
      // normal flow already fills its container, so a `1fr` track gets its
      // definite basis for free.
      //
      // `COLUMN_TRACKS` is a constant — the tracks themselves live on the root
      // as a custom property. That is what keeps a resize from rewriting this
      // attribute on every mounted row, every frame.
      // Two things about the focused cell are published here rather than
      // chosen there, because both are things only the ROW knows: whether it
      // is selected, which decides the ring's tint, and whether it is the
      // first row, which decides how far the ring may reach above itself. See
      // CELL_FOCUS_FILL_VAR and CELL_FOCUS_TOP_VAR.
      style={{
        ...style,
        ...COLUMN_TRACKS,
        [CELL_FOCUS_FILL_VAR]: selected ? 'var(--color-indigo-3)' : 'var(--color-indigo-2)',
        // -1px everywhere, so the ring covers the border of the row above it.
        // On row 0 there IS no row above, only the sticky header — which is
        // opaque and has to keep passing over the cells — so the ring's top
        // edge stays inside the cell, where it can be seen.
        [CELL_FOCUS_TOP_VAR]: index === 0 ? '0px' : '-1px',
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
