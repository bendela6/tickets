import type { CSSProperties } from 'react';

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
 * No inset on the row. The tracks start at the table's frame.
 *
 * There used to be 4px here, with the leading column taking 12px of its own to
 * make 16px of air at the edge. The air is the same either way, but the inset
 * put a 4px strip of row OUTSIDE the first column — so a focused first cell's
 * ring stopped 4px short of the frame and read as misaligned, while every
 * other column's ring sat exactly on its divider. The 16px now lives entirely
 * in the leading column's gutter, which keeps the content where it was and
 * lets the first and last cells reach their edges.
 *
 * Exported as an empty string rather than deleted: every row-shaped slot still
 * composes it, so if an inset is ever wanted back, it goes in one place and
 * cannot be applied to three of the four rows by accident.
 */
export const ROW_INSET = '';

/**
 * Fixed header height. Fixed rather than derived from the header cells'
 * padding so the sticky header stays 40px regardless of what a caller renders
 * into a header — an icon or a taller control in one column must not make the
 * whole header grow.
 */
export const HEAD_HEIGHT = 'h-40';

/**
 * The header's own surface, distinct from the rows beneath it.
 *
 * The header is a different SURFACE, not merely the first row — that is what
 * lets its labels drop out of tracked uppercase into ordinary sentence case
 * and still read as headings. The band does the work the letterforms used to,
 * and a `gray-7` rule under it rather than the rows' `gray-6` says the same
 * thing again.
 *
 * The dark override is the load-bearing part. The neutral ramp inverts between
 * themes but `surface-raised` does not follow it, so the pair that separates
 * cleanly in light collapses in dark:
 *
 *     light   header gray-3 #edece6   rows surface-raised #ffffff   ✓
 *     dark    header gray-3 #25231e   rows surface-raised #252320   ✗
 *
 * Two values apart in one channel — the band vanished into the rows. In light
 * the header sits BELOW the row surface and in dark it has to sit ABOVE it, so
 * `gray-5` (#2f2c25) is the same one-step separation reached from the other
 * side. Picking a token per theme is the point here, not an accident: "one
 * step away from the rows" is the rule, and which direction that is depends on
 * which way the ramp runs.
 */
export const HEAD_SURFACE = 'bg-gray-3 dark:bg-gray-5 border-b-gray-7';

/**
 * The totals row's height.
 *
 * Its own number now, and no longer `HEAD_HEIGHT`. It used to share it so the
 * table was "bracketed by two bands of equal weight", which stopped being true
 * the moment the header grew to 40px: the header is a surface you read across,
 * the totals row is a single summarising line, and the design gives them 40
 * and 36 respectively.
 */
export const TOTALS_HEIGHT = 'h-36';

/**
 * Where the pinned group band sticks: directly under the column header.
 *
 * Derived from `HEAD_HEIGHT` rather than written again, because the two are
 * the same measurement seen from opposite ends — a band that sticks at 36
 * under a 40px header leaves a 4px seam that rows scroll through. A filter row
 * between them will add its own height here; that is the second reason this is
 * a named constant and not a `top-40` inline.
 */
export const BAND_STICKY_TOP = 'top-40';

/**
 * The filter row's height: an `xs` control (30px) with 3px of air above and
 * below. Its own number rather than `HEAD_HEIGHT`, because the header is a
 * band of labels and this is a band of inputs — and the inputs set the size.
 */
export const FILTER_ROW_HEIGHT = 'h-36';

/**
 * Where the pinned group band sticks when there is a filter row: under both
 * halves of the header. 76 is `HEAD_HEIGHT` (40) plus `FILTER_ROW_HEIGHT`
 * (36) — written out because a class cannot add, and kept beside the two it
 * sums so a change to either lands here too.
 */
export const BAND_STICKY_TOP_BELOW_FILTERS = 'top-76';

/**
 * Per-cell gutter. The leading column is roomier than the rest, which puts
 * 16px of air at the table's left edge while keeping adjacent columns 16px
 * apart (8px + 8px).
 *
 * All 16 of the leading column's gutter is here now; it used to be 12 plus a
 * 4px inset on the row — see `ROW_INSET` for why that moved.
 *
 * Takes the column's position rather than the column itself: "am I the first
 * column?" is a question about the table's edge, not about the column's own
 * identity, and `column.key` cannot answer it.
 *
 * The one column that wants neither of these is the selection column, and it
 * is not a third branch here for exactly that reason: "am I a checkbox?" is
 * not a question about position either. It overrides this instead — see
 * `SELECT_CELL`.
 */
export function cellGutter(index: number): string {
  return index === 0 ? 'px-16' : 'px-8';
}

/**
 * The selection column's box: no gutter, and its contents centred.
 *
 * A selection column is the LEADING column, so `cellGutter` hands it the
 * table's 16px edge gutter — right for a leading column of text, whose first
 * letter has to clear the frame, and wrong for the one leading column that
 * holds no text. Under that gutter a 36px selection track has 4px of content
 * box left: the checkbox sat 16px from the left with the remainder on the
 * other side, the only tick in the table not in the middle of its own column.
 *
 * So the gutter goes and the box centres what it holds. `justify-center`
 * rather than a symmetric pair of numbers, because the checkbox's width is the
 * Checkbox primitive's to choose and a hard-coded pair would fall out of step
 * with it the day that rung moves.
 *
 * Composed AFTER `cellGutter` and the cell's alignment at every call site: it
 * is deliberately an override of two earlier decisions, and putting it last is
 * what lets `cn` evict them.
 *
 * `column.select` is the handle, never the column's key — `select` is what the
 * ENGINE keys off to own this column's content (see `Column.select`), and a
 * selection column is still one when its key is spelled something else.
 */
export const SELECT_CELL = 'justify-center px-0';

/**
 * The rule between two columns — the vertical half of the grid, the row's own
 * `border-b` being the horizontal half. Both are `gray-6`, the same hairline
 * the header, the pinned edge and the scroll edges already use, so a ruled
 * table reads as one grid rather than four different greys.
 *
 * `border-l` rather than `border-r`, and skipped on the leading column, so
 * the table gets a line BETWEEN columns and no stray rule against either outer
 * edge. That shape is also the only one a cell can decide on its own: the
 * render context reports a column's `index`, never a column count, so "am I
 * last?" is not a question a slot can answer — "am I first?" is.
 *
 * Sided colour (`border-l-gray-6`, not `border-gray-6`) on purpose: a pinned
 * column's edge sets its own colour on one side, and an all-sides colour class
 * beside it would be merged away by `cn` — or would repaint this divider.
 */
export function cellDivider(index: number): string {
  return index === 0 ? '' : 'border-l-1 border-l-gray-6';
}

/**
 * The rule on the LAST column's right-hand edge, when the columns do not fill
 * the table.
 *
 * `cellDivider` rules between columns and therefore never reaches the outside
 * of the last one — which is fine while the columns fill the frame, because
 * the frame's own border is that edge. When they do not, there is empty table
 * past the last column and the grid stops in mid-air: the header still draws a
 * line there (its resize grip stands on every column edge, last one included)
 * and nothing below it does, so the column appears to lose its side halfway
 * down.
 *
 * The engine says when — it is the only thing that knows both the column count
 * and the measured width, and `RenderThCtx.trailing` is the answer.
 */
export function trailingDivider(trailing: boolean | undefined): string {
  return trailing ? 'border-r-1 border-r-gray-6' : '';
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

/**
 * A row's height in pixels for a density, 42 comfortable or 32 compact: what
 * `useTable`'s `rowHeight` takes, as `rowHeight={rowHeightFor(density)}`.
 * @param density How tightly the rows sit.
 */
export function rowHeightFor(density: Density): number {
  return ROW_HEIGHT[density];
}

/**
 * The focused cell's ring, drawn as an overlay rather than an outline.
 *
 * A focused cell IS a one-cell range — that is the whole idea, and it is what
 * stops focus and range selection ever becoming two different-looking
 * rectangles. So the ring is 1px of indigo-9 drawn exactly ON the cell's own
 * rules, replacing the grey there, over an indigo fill.
 *
 * The offsets are deliberately asymmetric. `left-0` sits on the cell's own
 * `border-l` divider; `-right-1`, `-top-1` and `-bottom-1` reach one pixel out
 * to cover the NEIGHBOUR's divider and the row's own `border-b`. Every edge of
 * the rectangle therefore lands on a rule that already exists, so nothing
 * shifts and no rule is ever drawn twice.
 *
 * `z-1` is a rung above the row and a rung BELOW a frozen column's `z-2`. The
 * ring only has to clear the neighbour whose divider it covers; one that
 * outranked the frozen band would go on painting after the cell carrying it
 * had slid underneath, leaving a pixel of indigo crossing a column the cell is
 * no longer in. The case that genuinely has to outrank the band is a focused
 * cell that is ITSELF pinned, and that is the cell's problem rather than the
 * ring's — see `CELL_FOCUS_LIFT`.
 *
 * The top edge is the one the cell cannot settle alone. On the FIRST row that
 * pixel lands under the sticky header, which is opaque and has to stay above
 * the cells or it stops covering the rows scrolling beneath it. So the ROW
 * says how far the ring may reach up — `CELL_FOCUS_TOP_VAR`, applied through
 * `CELL_FOCUS_RING_STYLE` — and on row 0 the top edge stays inside the cell,
 * where it is visible. `-top-1` stays in the class so this constant is still
 * correct on its own for anything that uses it without the style.
 *
 * An overlay and not an `outline`: an outline cannot be asymmetric, and the
 * 2px inset one this replaces left a visible gap between ring and cell edge —
 * harmless alone, wrong the moment a range has to continue the same line
 * across several cells.
 *
 * Not a `focus-visible` variant, for the reason it never was: the grid's focus
 * is a MODEL. The engine says which cell holds it via `RenderTdCtx.focused`,
 * and arrow-key navigation must draw the ring whether or not the browser
 * considers the interaction keyboard-driven.
 */
export const CELL_FOCUS_RING =
  'pointer-events-none absolute -top-1 -right-1 -bottom-1 left-0 z-1 border-1 border-indigo-9';

/**
 * The focused cell's fill, named so a ROW can set it and a CELL can use it.
 *
 * The fill answers a question the cell cannot: indigo-2 normally, indigo-3
 * over a row that is already selected — otherwise the ring sits on a tint
 * barely distinguishable from its own. `RenderTdCtx` carries no `selected`
 * (focus is per cell, selection is per row), so rather than widen the engine's
 * contract for a colour, the row publishes the right value and the cell reads
 * it. The same trick `bg-inherit` plays for pinned cells.
 */
export const CELL_FOCUS_FILL_VAR = '--cell-focus-fill';

/** `style={CELL_FOCUS_FILL}` on the focused cell — see `CELL_FOCUS_FILL_VAR`. */
export const CELL_FOCUS_FILL: CSSProperties = Object.freeze({
  background: `var(${CELL_FOCUS_FILL_VAR})`,
});

/**
 * How far the focused cell's ring may reach ABOVE itself, named so a ROW can
 * set it.
 *
 * The same trick as `CELL_FOCUS_FILL_VAR`, for a value of the same shape: the
 * answer turns on something `RenderTdCtx` does not carry — there, whether the
 * row is selected; here, whether it is the FIRST row, whose neighbour above is
 * the sticky header rather than another row. The header is opaque and must
 * stay above the cells, so a ring reaching a pixel into it is a ring with an
 * invisible top edge. Row 0 keeps that edge inside the cell instead.
 *
 * Published by the row rather than asked of the engine: the row is handed its
 * own index already, so widening the render contract with a row index would be
 * paying for something we have.
 */
export const CELL_FOCUS_TOP_VAR = '--cell-focus-top';

/** `style={CELL_FOCUS_RING_STYLE}` on the ring — see `CELL_FOCUS_TOP_VAR`. The
 *  fallback repeats the class's own `-top-1`, so a ring drawn inside a slot
 *  that publishes nothing keeps the geometry it was designed with. */
export const CELL_FOCUS_RING_STYLE: CSSProperties = Object.freeze({
  top: `var(${CELL_FOCUS_TOP_VAR}, -1px)`,
});

/**
 * A pinned cell: `position: relative`, moved by the engine's `pin.shift`.
 *
 * It was `sticky` until the table gave up its scroll box. Sticky answers to a
 * scrollport, and the clip the columns now slide under is deliberately not one
 * — see `pinStyle`, which turns the engine's number into the offset that keeps
 * this cell still.
 *
 * `bg-inherit` is the load-bearing part: a pinned cell must be opaque or the
 * cells sliding under it show through, and inheriting is the only way for it
 * to follow the row's hover and selected tints instead of freezing one colour.
 * It also means every row shape that hosts a frozen cell owes it a real
 * colour — `bg-surface-raised` on a body row and on the skeleton, `bg-gray-1`
 * on the totals row.
 *
 * Used by all four of the table's row shapes: the header, the body rows, the
 * loading skeleton and the totals row. They do not all sit in the same
 * stacking context, which is the one thing to know before reading the ladder
 * below — see the note after it.
 *
 * The whole ladder, lowest first, because every rung is set against the ones
 * around it and two of them were got wrong in one sitting:
 *
 *   `z-1`  the focus ring, inside its own cell (`CELL_FOCUS_RING`)
 *   `z-6`  a column's resize grip (`render-th.tsx`)
 *   `z-7`  a frozen column — here
 *   `z-8`  the focused frozen cell (`CELL_FOCUS_LIFT`)
 *   `z-9`  the sticky group band
 *   `z-10` the column header and the totals row
 *   `z-11` the freeze scrim (`render-scrim.tsx`)
 *
 * Above the grips is the part that is easy to lose: a grip belongs to the
 * column it sits on, so an unpinned column scrolling under the frozen band
 * takes its grip with it, and at any rung below `z-6` that grip draws a live
 * resize line straight across the frozen cells. It was `z-10` once, tied with
 * the header and beneath it only because the header comes first in the DOM;
 * that tie is why it moved, since the focused cell needs a rung between the
 * band and the chrome. `z-2` was that move overshooting — under the grips,
 * which is what put the lines back.
 *
 * The ladder is ONE ladder for the body rows and the skeleton, which are in
 * normal flow and open no stacking context of their own, so their `z-7` cells
 * really do sit between the grips and the group band. The header and the
 * totals row are `sticky` WITH a `z-index`, which opens one each: a frozen
 * cell inside either of them is `z-7` against its own siblings and nothing
 * else, while the row as a whole holds `z-10` against the table. That is the
 * answer wanted anyway — both are chrome the rows scroll under, so they must
 * stay above the frozen band rather than join it — and it is why freezing the
 * totals row's cells needed no new rung here.
 */
export const PINNED_CELL = 'relative z-7 bg-inherit';

/**
 * The focused cell, lifted over the frozen column beside it.
 *
 * `CELL_FOCUS_RING` reaches a pixel to the right to cover the NEIGHBOUR's
 * `border-l`, which works only while the ring paints above that neighbour. A
 * pinned neighbour beats it twice over — a layer of its own, and a later
 * position in the row — so the ring's right-hand edge vanished under it. In a
 * table whose two leading columns are both frozen that is the edge you look at
 * most.
 *
 * Only a PINNED focused cell is lifted, and the asymmetry is the point. An
 * unpinned one slides UNDER the frozen band as the table scrolls sideways, and
 * a cell lifted over the band would show through it, fill and all. It does not
 * need lifting for an ordinary neighbour either — its ring already clears that
 * divider. What is left over is an unpinned cell beside a RIGHT-pinned column,
 * where the ring's right edge stays under the band: the same trade the first
 * row's top edge makes against the header, and settled the same way, because
 * sticky chrome wins.
 *
 * `z-8` and no higher: one rung above the frozen band's `z-7`, and below the
 * group band's `z-9` and the sticky header's `z-10`, both of which must go on
 * passing over this cell. The ladder is written out over `PINNED_CELL`.
 */
export const CELL_FOCUS_LIFT = 'z-8';

/**
 * The edge between the frozen columns and the part that scrolls: a shadow the
 * band casts onto whatever is sliding under it.
 *
 * Only the INNERMOST pinned column carries it — the engine marks that one —
 * so a table with three frozen columns gets one edge, not three.
 *
 * A SHADOW, and the argument that said it could not be one is the thing worth
 * writing down. It ran: every `shadow-*` token here casts on all four sides,
 * which on a 32px row smudges above and below, and a one-sided shadow can only
 * be spelled as an arbitrary value, which this project does not allow. Both
 * halves were true and the conclusion was still wrong. What the rule against
 * arbitrary values actually costs is that a treatment the design system has no
 * token for cannot be written at a call site — it does not say the treatment
 * is unavailable, it says the system is missing a token. So the system now has
 * one: `shadow-pin-left` / `shadow-pin-right`, defined in this package's own
 * stylesheet beside `shadow-well`, which was already exactly this move for an
 * inset one-sided shadow. The four-sided smudge is answered there too, by
 * geometry rather than by giving up — see the comment on the utility.
 *
 * What the hairline could not do is the reason it went. It was drawn per cell
 * as a `border`, so it lived INSIDE the frozen cell, one pixel to the left of
 * the first scrolling column's own `cellDivider` — two hairlines a pixel
 * apart, which is the doubled rule at the boundary, and it came apart the
 * moment the table slid sideways and the divider walked off. The shadow's
 * 1px line is cast one pixel OUT of the cell instead, so it lands on that
 * divider's pixel and covers it: one edge, whatever is under it.
 *
 * `border-l-0` on the right-hand form, and nothing on the left, because the
 * two sides sit differently against `cellDivider`. A left-pinned edge column's
 * own `border-l` is an honest rule between two frozen columns and stays. A
 * right-pinned edge column's `border-l` IS the boundary, so it would draw a
 * `gray-6` hairline immediately inside the cast line — it is zeroed here
 * rather than at `cellDivider`, which has no way to know a column is pinned,
 * and it works because every call site composes this LAST and `cn` evicts the
 * earlier width. The colour class it leaves behind paints nothing at zero
 * width.
 */
export const PINNED_EDGE: Record<'left' | 'right', string> = {
  left: 'shadow-pin-left',
  right: 'border-l-0 shadow-pin-right',
};

/**
 * The table's frame: a 1px `gray-6` box with a 4px radius, around a raised
 * surface.
 *
 * The table is an OBJECT sitting on the page, not a region bled into it. Rows
 * are `surface-raised` and the page around them is not, so the frame is the
 * edge of the sheet those rows sit on.
 *
 * It was 2px `gray-7` — an outer edge argued louder than the rules inside it.
 * In practice that read as a heavy box drawn around the page's content rather
 * than the quiet edge of a sheet, so it now matches the hairline weight and
 * colour of `cellDivider`: the frame is the outermost rule of the same grid,
 * not a different kind of line. The one place weight still means something is
 * `SCROLL_EDGE`, which steps a hidden edge to `gray-8` — and that step reads
 * MORE clearly from `gray-6` than it did from `gray-7`.
 *
 * It belongs on the SCROLL CONTAINER, not on the grid root. The root is the
 * scrolled content and is wider than the viewport whenever the table scrolls
 * sideways, so a frame drawn there slides away with column one. (An earlier
 * pass put it on the root for exactly the opposite reason; that was wrong —
 * the design's frame is a fixed box around the whole table.)
 *
 * The radius plus the container's own `overflow` is also what rounds the first
 * and last rows into the corners, with no row needing to know it is first or
 * last.
 */
export const TABLE_FRAME = 'rounded-4 border-1 border-gray-6 bg-surface-raised';

/**
 * The status bar: the strip along the bottom that says what you are looking
 * at.
 *
 * 28px, mono 11/13 in `gray-11` over `gray-1`, with a `gray-6` rule above it —
 * the quietest chrome in the table, because it is the one part that is never
 * the answer to a question, only context for one.
 *
 * `overflow-hidden` and `whitespace-nowrap`: a narrow table shortens what it
 * says rather than growing a second line and moving the table's bottom edge.
 */
export const TABLE_STATUS_BAR =
  'text-11/13 text-gray-11 border-t-gray-6 bg-gray-1 flex h-28 items-center justify-between gap-16 overflow-hidden px-16 font-mono whitespace-nowrap border-t-1';

/**
 * Which edge of the frame has content hidden past it.
 *
 * The frame is `gray-6` at rest; whichever side is hiding content steps to
 * `gray-8` — the same colour the freeze line and the totals rule use, and for
 * the same reason. `gray-8` means one thing throughout this table: content
 * slides under this line.
 *
 * A sided colour so it overrides only that edge of `TABLE_FRAME` rather than
 * repainting the whole box.
 */
export const SCROLL_EDGE: Record<'none' | 'start' | 'middle' | 'end', string> = {
  none: '',
  start: 'border-r-gray-8',
  middle: 'border-x-gray-8',
  end: 'border-l-gray-8',
};

/**
 * The column tracks, declared once on the table and inherited by every row.
 *
 * A resize rewrites the track list on every pointer move. Written per row that
 * is one `style` attribute mutation per mounted row per frame — about twenty,
 * plus the header — and while the layout cost of that is around a millisecond,
 * the MUTATION cost is not paid by the page at all: devtools is notified of
 * every attribute change over the inspector protocol, so with the Elements
 * panel open a drag turns into roughly twelve hundred notifications a second
 * and the interaction visibly crawls.
 *
 * As a custom property on the table root it is one mutation instead of twenty,
 * because each row's own `grid-template-columns` is now the CONSTANT string
 * `var(--table-cols)` — React diffs it as unchanged and never touches the
 * attribute. The tracks still change; only one node hears about it.
 *
 * The name is shared through this module rather than written at both ends,
 * because a typo in either half is a table that silently loses all its
 * columns — `grid-template-columns: var(--undefined)` is not an error, it is
 * a single auto track.
 */
export const COLUMN_TRACKS_VAR = '--table-cols';

/**
 * `style={COLUMN_TRACKS}` — what every row-shaped slot lays out on.
 *
 * A frozen module-level object, not a fresh literal per render: it is passed
 * as a style object, and a new identity each time would defeat the diff this
 * exists to win.
 */
export const COLUMN_TRACKS: CSSProperties = Object.freeze({
  gridTemplateColumns: `var(${COLUMN_TRACKS_VAR})`,
});
