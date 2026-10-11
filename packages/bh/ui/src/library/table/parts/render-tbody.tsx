import type { RenderTbodyCtx } from '@bh/table';

/**
 * The row container.
 *
 * No explicit height and no `position: relative` any more. Both existed to
 * serve rows that positioned themselves absolutely against this box; rows are
 * in normal flow now, so the engine's padding above and below the mounted
 * window plus the rows themselves come to exactly `totalSize` on their own.
 *
 * No `min-w-max` either. It used to be here to let rows overflow a narrow
 * container, but with rows in normal flow it meant the rowgroup sized itself to
 * the widest MOUNTED row — so the table changed width as you scrolled. Columns
 * come from the track list; tracks too wide for the container overflow it, and
 * that overflow is what the scroll container scrolls.
 */
export function renderTbody({ children, style, ref }: RenderTbodyCtx) {
  // The ref is not optional decoration: the virtualizer rides the page's
  // scroll position, and this is the element that tells it where the rows
  // start inside that page. Drop it and every mounted row sits at the wrong
  // offset by the height of whatever is above the table.
  return (
    <div role="rowgroup" ref={ref} style={style}>
      {children}
    </div>
  );
}
