import type { TableRender } from '@bh/table';
import { cn } from '../../style';
import { copyText } from '../primitives/components/use-copy';
import { SCROLL_EDGE, TABLE_FRAME } from './parts/metrics';
import { renderStatusBar } from './parts/render-status-bar';
import { renderHbar } from './parts/render-hbar';
import { renderResizeGuide } from './parts/render-resize-guide';
import { renderScrim } from './parts/render-scrim';
import { renderRoot } from './parts/render-root';
import { renderThead } from './parts/render-thead';
import { renderTh } from './parts/render-th';
import { renderTbody } from './parts/render-tbody';
import { renderTr } from './parts/render-tr';
import { renderTd } from './parts/render-td';
import { renderSkeletonRow } from './parts/render-skeleton-row';
import { renderError } from './parts/render-error';
import { renderEmpty, type EmptyCopy } from './parts/render-empty';
import { renderTfoot } from './parts/render-tfoot';
import { renderFilterRow } from './parts/render-filter-row';
import { renderGroupHeader } from './parts/render-group-header';
import { renderSelectCell } from './parts/render-select-cell';

/**
 * `@bh/ui`'s skin for `<Table>`: every render slot, drawn in Instrument's
 * style. Call it typed by the row, as `render={tableRender<Row>()}`.
 * @param opts `empty`: what the table says while it has no rows yet.
 */
/*
 * A generic factory rather than a constant. The individual slots are already
 * generic (`renderTh<T>` etc.), but assembling them into a plain
 * `const tableRender: TableRender` pins the whole set to
 * `TableRender<unknown>` — and because each slot takes a `T`-typed context,
 * `TableRender<unknown>` is not assignable to `TableRender<Row>`. The adapter
 * would then be unusable with any concrete row type.
 *
 * A factory instantiates the slots at the call site instead. Mirrors
 * `makeStubRender<T>()` in @bh/table. The returned object is cheap — nine
 * references to module-level functions — and the engine never keys off its
 * identity, so calling it inline in JSX is fine.
 *
 * The one thing it takes is the empty state's copy, and it takes it here
 * rather than making the caller replace a slot: "no rows YET" is the one of
 * these states whose words are specific to what the table holds, and a page
 * that has to hand over `empty` to change two strings ends up owning the
 * layout of a state it did not want to design. Everything else — the failure,
 * the filtered-empty, the skeleton — says the same thing for every table.
 */
export function tableRender<T>(opts: { empty?: EmptyCopy } = {}): TableRender<T> {
  return {
    root: renderRoot,
    thead: renderThead,
    th: renderTh,
    tbody: renderTbody,
    tr: renderTr,
    td: renderTd,
    groupHeader: renderGroupHeader,
    skeletonRow: renderSkeletonRow,
    error: renderError,
    empty: (ctx) => renderEmpty(ctx, opts.empty),
    tfoot: renderTfoot,
    filterRow: renderFilterRow,
    selectCell: renderSelectCell,
    statusBar: renderStatusBar,
    // The frame is the one element the engine cannot hand over: it carries
    // the measurement ref and the height the table fills. So it takes a class
    // rather than a node. The engine says WHICH edges hide content; what that
    // looks like stays here, in metrics.
    frameClass: ({ scrollX }) => cn(TABLE_FRAME, SCROLL_EDGE[scrollX]),
    hbar: renderHbar,
    resizeGuide: renderResizeGuide,
    scrim: renderScrim,
    // Ctrl+C on a cell writes through the same `copyText` as every copy
    // button, and `renderTd` shows how it went.
    onCopyCell: copyText,
  };
}
