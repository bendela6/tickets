import type { RenderHbarCtx } from '@bh/table';
import { cn } from '../../../style';

/**
 * The table's horizontal scrollbar: one thumb, no track, no chrome.
 *
 * Drawn rather than native because the table's clip box is deliberately not a
 * scroll container, so there is no scrollbar to inherit — and because a native
 * one would be the platform's, which is a chunky always-visible bar on Windows
 * and an invisible one on macOS. This is the same in both.
 *
 * It appears when the pointer is over the table, while the table is moving,
 * and while the thumb is held; otherwise it fades out. The engine decides
 * which of those is true (`visible`); this decides what that looks like.
 *
 * **The strip keeps its height whether or not the thumb is showing.** Fading
 * an element that also collapses would move the status bar under it and the
 * totals row above it every time the pointer crossed the table. Only opacity
 * changes here.
 *
 * Colour comes off the neutral ramp rather than a per-theme override: `gray-8`
 * is a mid-grey at both ends of a ramp that inverts with the theme, so the
 * thumb reads the same against a white sheet and a dark one. `gray-10` on
 * hover and while dragging is the same step the resize grip takes.
 */
export function renderHbar({
  thumbWidth,
  thumbOffset,
  dragging,
  visible,
  thumbProps,
  trackProps,
}: RenderHbarCtx) {
  return (
    <div
      {...trackProps}
      data-slot="table-hbar"
      data-visible={String(visible)}
      // `touch-none` so a finger on the thumb drags it instead of panning the
      // page underneath. The strip is 10px: a 4px thumb with 3px either side,
      // which is enough of a target without drawing a bar's worth of line.
      className="relative h-10 w-full shrink-0 touch-none"
    >
      <span
        {...thumbProps}
        aria-hidden
        className={cn(
          'rounded-2 absolute top-3 h-4 cursor-grab transition-opacity duration-150',
          // Guarded for the people who ask not to be animated: the bar still
          // appears and disappears, it just stops fading.
          'motion-reduce:transition-none',
          // Hidden is the class; shown is the absence of it. A bare
          // `opacity-100` never appears in this library — only variant forms
          // like `group-hover:opacity-100` — so it is not in the generated
          // CSS, and asking for it silently leaves the thumb at zero.
          !visible && 'opacity-0',
          dragging ? 'bg-gray-10 cursor-grabbing' : 'bg-gray-8 hover:bg-gray-10',
        )}
        style={{ width: thumbWidth, transform: `translateX(${thumbOffset}px)` }}
      />
    </div>
  );
}
