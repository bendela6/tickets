import { useState } from 'react';
import {
  HEADER_ACCESSORY_ATTR,
  useColumnResize,
  type RenderThCtx,
  type RenderThResize,
} from '@bh/table';
import { cn, focusRing } from '../../../style';
import { Icon } from '../../primitives/components/icon';
import {
  cellDivider,
  trailingDivider,
  cellGutter,
  PINNED_CELL,
  PINNED_EDGE,
  SELECT_CELL,
} from './metrics';
import { pinStyle } from './render-td';

/** Column headers carry aria-sort so a screen reader announces the sort state
 *  the caret shows visually. */
function ariaSort(direction: 'asc' | 'desc' | undefined) {
  if (direction === 'asc') {
    return 'ascending' as const;
  }
  if (direction === 'desc') {
    return 'descending' as const;
  }
  return 'none' as const;
}

/**
 * The column-edge grip: the affordance that says a column can be dragged.
 *
 * Three states, and the resting one is the point. A handle that only appears
 * once the pointer is already on it cannot be discovered — you have to know it
 * is there to find it. So at rest it draws a 1px `gray-7` line the full height
 * of the header: one step darker than the `gray-6` rule between body cells,
 * which is the ONE place the header's rules deliberately differ from the
 * body's, so a column edge reads as something that moves.
 *
 * Hover thickens it to 3px `gray-9` under a `col-resize` cursor; dragging
 * turns it `indigo-9`, the accent this table reserves for focus and selection.
 *
 * The hit area stays 4px and straddles the boundary (`-right-2`) while the
 * drawn line is 1 or 3px centred inside it — a target you can hit, from a mark
 * quiet enough to sit on every column.
 */
function ResizeHandle({ resize }: { resize: RenderThResize }) {
  // Local, not engine state: nothing outside this handle needs to know the
  // pointer is down on it. The width the drag produces is already reported
  // through `onWidthChange`.
  const [dragging, setDragging] = useState(false);
  const handlers = useColumnResize({
    startWidth: resize.startWidth,
    minWidth: resize.minWidth,
    // Two consumers of the same number, and they are not the same statement.
    // `onWidthChange` is the result — the column IS this wide now. The second
    // is the fact that a drag is in progress, which the engine needs because
    // the guideline and the chip are drawn over the whole table and no header
    // cell can reach that far.
    onChange: (px) => {
      resize.onWidthChange(px);
      resize.onDragChange?.(px);
    },
  });
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      {...handlers}
      onPointerDown={(e) => {
        setDragging(true);
        // The starting width, so the guideline appears on the edge it is about
        // to move rather than waiting for the first pointer move.
        resize.onDragChange?.(resize.startWidth);
        handlers.onPointerDown(e);
      }}
      onPointerUp={(e) => {
        setDragging(false);
        resize.onDragChange?.(null);
        handlers.onPointerUp(e);
      }}
      // Double-clicking a resize handle to fit the column to its contents is
      // the gesture every spreadsheet has trained people to expect, and it is
      // the fastest way out of a column that truncates everything.
      onDoubleClick={resize.onAutoFit}
      className="group/grip absolute top-0 -right-2 z-6 flex h-full w-4 cursor-col-resize justify-center"
    >
      <span
        aria-hidden
        className={cn(
          'h-full',
          dragging
            ? 'bg-indigo-9 w-3'
            : 'bg-gray-7 group-hover/grip:bg-gray-9 w-1 group-hover/grip:w-3',
        )}
      />
    </div>
  );
}

/**
 * The sort affordance, in three states rather than two.
 *
 * A caret that appears only once a column IS sorted answers "how is this
 * sorted" but never "can this be sorted" — so before the first click every
 * column looks identical and sortability is invisible. The hover state is the
 * missing third: a faint `arrow-up-down`, shown only on columns that sort.
 *
 * It is rendered always and revealed with opacity rather than mounted on
 * hover, so the header's layout is identical whether or not the pointer is
 * over it — a glyph appearing into the flow would shove the label sideways.
 *
 * `md` is the icon ladder's default rung, and it is the right one here for the
 * reason the smallest rung was the wrong one: at `2xs` (8px) the caret was
 * smaller than the type beside it, which made the one element in the header
 * you are meant to aim at the hardest thing in it to see. A glyph that means
 * "click me" cannot be the quietest mark on the row.
 */
function SortMark({
  sort,
  totalSorts,
}: {
  sort?: { direction: 'asc' | 'desc'; index: number };
  totalSorts: number;
}) {
  if (!sort) {
    return (
      <Icon
        name="arrow-up-down"
        // Not `text-gray-8`: the hint now inherits the cell's own colour, which
        // is already stepping from `gray-11` to `gray-12` under the same hover
        // that reveals it. Two colours changing on one gesture said nothing
        // extra.
        className="opacity-0 transition-opacity group-hover/th:opacity-100"
      />
    );
  }
  return (
    <span className="flex items-center gap-2">
      <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} />
      {/* The ordinal only means something once more than one column sorts. */}
      {totalSorts > 1 ? (
        <span className="text-11 text-gray-11 font-mono">{sort.index + 1}</span>
      ) : null}
    </span>
  );
}

export function renderTh<T>({
  column,
  index,
  sort,
  totalSorts,
  onSortClick,
  resize,
  // `RenderThCtx.focused` is deliberately NOT taken here. The engine still
  // tracks which header holds focus, and `focusProps` still carries the roving
  // tab stop that makes it reachable; what a header does not do is PAINT that
  // flag — see the class list below.
  focusProps,
  pin,
  trailing,
  children,
}: RenderThCtx<T>) {
  // Truthiness, not `!= null`: `children` is a ReactNode, and an empty string
  // or a 0 has to fall through to the sortable header the same way `undefined`
  // does. Hoisted so the branch below is not an `a ? a : b` shape, which reads
  // as a nullish-coalescing candidate it is not.
  const hasChildren = Boolean(children);
  const mark = column.sortable ? <SortMark sort={sort} totalSorts={totalSorts} /> : null;
  return (
    <div
      role="columnheader"
      aria-sort={column.sortable ? ariaSort(sort?.direction) : undefined}
      aria-colindex={index + 1}
      // Carries the roving tabindex and this cell's coordinates. `rowIndex`
      // is -1 for every header cell, which is what makes ArrowUp from row 0
      // land here and sorting reachable without a mouse.
      {...focusProps}
      className={cn(
        // No vertical padding: the header's height is fixed by the row, and
        // the cell stretches into it so the resize handle spans all 40px.
        //
        // A NAMED group: the row is already a plain `group` for row actions,
        // and the sort hint must answer to this cell rather than to the whole
        // header row.
        'group/th relative flex items-center',
        cellGutter(index),
        cellDivider(index),
        trailingDivider(trailing),
        // Sentence case at 12/17 rather than tracked 11px caps. The header
        // earns its separation from the rows through its own surface now
        // (`HEAD_SURFACE`), so the letterforms no longer have to shout.
        'text-12/17 font-500 font-sans',
        // Every label starts at the same left edge, INCLUDING a right-aligned
        // column's. The cell under it is still right-aligned — the alignment
        // belongs to the values, which line up by their last digit, not to the
        // word naming them. Following the numbers left the header row with
        // labels at ragged positions across the table and no reading order,
        // and it collided with the other half of this change: the sort control
        // is pinned to the right of every header, so a right-aligned label was
        // pushed into it.
        'justify-start',
        // The select-all box centres in its column, like every tick beneath
        // it. Overrides the gutter and the alignment above — see SELECT_CELL.
        column.select && SELECT_CELL,
        // The hover tint is on the CELL, not on the button inside it, so the
        // band reaches the column's dividers — a background paints under
        // padding, and the button only ever fills the content box.
        column.sortable && 'hover:bg-gray-4 dark:hover:bg-gray-6',
        // The sorted column reads at full strength; the rest sit back a step
        // and come forward on hover, which is also when the sortability hint
        // appears — one gesture, one answer.
        sort ? 'text-gray-12 font-600' : 'text-gray-11 hover:text-gray-12 hover:font-600',
        // A header shows keyboard focus, and ONLY keyboard focus. This is the
        // one place in the table where the focus treatment is not the engine's
        // `focused` flag, and the difference is what the two things are. A body
        // cell is a one-cell RANGE: it draws `CELL_FOCUS_RING` however focus
        // arrived, because a range you made with the mouse still has to look
        // like a range. A header is not part of any range — it is a control you
        // click to sort — so clicking one left an indigo box parked on it that
        // meant nothing, which is the fault this fixes.
        //
        // What does NOT change is the focus model: the cell keeps its roving
        // tab stop and `focusProps`, so ArrowUp from row 0 still lands here and
        // Enter still sorts. Only the PAINT moves to `:focus-visible`, which
        // the browser fires for a keyboard arrival and withholds for a click.
        //
        // `inward`, the library's other placement, because an outward halo on a
        // 40px band bleeds over the rows below it and over the neighbouring
        // header — see focusRing.
        focusRing('indigo', 'focus-visible', 'inward'),
        pin && PINNED_CELL,
        pin?.edge && PINNED_EDGE[pin.side],
      )}
      style={pinStyle(pin)}
    >
      {/* The engine takes this cell over when it owns what goes in it — today
          that means the select-all checkbox above a `select` column, which
          neither sorts nor shows a label. */}
      {hasChildren ? (
        children
      ) : column.sortable ? (
        <button
          type="button"
          onClick={onSortClick}
          // The CELL is the tab stop, never a control inside it. That is the
          // whole point of a roving tabindex: one Tab reaches the grid, arrows
          // move within it, and Enter or F2 steps into whatever the cell holds.
          // A natively tabbable button here would put a second stop in every
          // sortable header, so tabbing through a ten-column table would take
          // twenty presses to get past it.
          tabIndex={-1}
          // No type classes here, deliberately. Tailwind's preflight sets
          // `font: inherit` on buttons, so family, size, weight and colour all
          // come from the cell — including the weight the cell switches on
          // hover. The `uppercase` this used to have to repeat (preflight does
          // not re-inherit text-transform) went with the uppercase itself.
          //
          // `h-full w-full` and `justify-between`: the control is the whole
          // header cell, not a word inside it. Full height because a 17px-tall
          // target in a 40px band is a sliver you have to aim at vertically for
          // no reason — the entire cell already means "sort by this". Full
          // width with the label and the mark pushed apart because the mark
          // belongs to the COLUMN, not to the end of the label: parked at the
          // right edge it sits in the same place in every header, so the sort
          // state of a table reads down one line rather than being hunted for
          // at the end of each label.
          //
          // `flex-1` and `min-w-0` rather than `w-full`: it fills the cell, but
          // gives way to a header accessory beside it instead of pushing it out.
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center justify-between gap-8"
        >
          {column.header}
          {mark}
        </button>
      ) : (
        column.header
      )}
      {/* The accessory — a filter funnel — sits after the sort control, never
          inside it: a click on it must not sort, and a button cannot hold a
          button. After it in the DOM too, so Enter on the cell still reaches
          the sort first; the engine finds this wrapper by its attribute when
          Alt+↓ asks for the accessory instead. `ml-auto` parks it at the
          right edge when the label is plain text rather than a button. */}
      {column.headerAccessory === undefined ? null : (
        <span
          {...{ [HEADER_ACCESSORY_ATTR]: '' }}
          className="ml-auto flex shrink-0 items-center pl-4"
        >
          {column.headerAccessory}
        </span>
      )}
      {resize ? <ResizeHandle resize={resize} /> : null}
    </div>
  );
}
