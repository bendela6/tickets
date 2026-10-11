import type { RenderResizeGuideCtx } from '@bh/table';

/**
 * What a column resize looks like while it is happening: a line where the edge
 * will land, and the width it will land at.
 *
 * Per B12, the spec's top-priority frame. The grip alone answers "am I
 * dragging"; it cannot answer the two questions that actually matter — where
 * this edge ends up relative to the rows below it, and how wide the column
 * will be when you let go.
 *
 * The line runs the full height of the table rather than the header's 40px,
 * which is the whole point: a column edge is a vertical thing, and you are
 * lining it up against content that is mostly further down. It is drawn over
 * everything (`z-20`) and takes no pointer events, so it cannot interrupt the
 * drag that is producing it.
 *
 * `indigo-9` is this table's accent, the same one the grip turns while live
 * and the same one focus and selection use. Nothing else in the table is that
 * colour, so a line in it can only mean "this is the thing you are doing".
 */
export function renderResizeGuide({ left, width, delta }: RenderResizeGuideCtx) {
  return (
    <div
      aria-hidden
      data-slot="table-resize-guide"
      className="pointer-events-none absolute top-0 bottom-0 z-20"
      style={{ left }}
    >
      <span className="bg-indigo-9 absolute inset-y-0 left-0 w-1" />
      {/* Beside the line and level with the header, so it never covers the
          edge it is describing. Mono, because it is two numbers. */}
      <span className="bg-indigo-9 text-11/20 rounded-4 font-500 absolute top-10 left-6 h-20 px-6 font-mono whitespace-nowrap text-white">
        {`${width}px · ${delta > 0 ? '+' : ''}${delta}`}
      </span>
    </div>
  );
}
