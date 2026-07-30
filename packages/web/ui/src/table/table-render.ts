import type { TableRender } from '@tickets/table';
import { renderRoot } from './render-root';
import { renderThead } from './render-thead';
import { renderTh } from './render-th';
import { renderTbody } from './render-tbody';
import { renderTr } from './render-tr';
import { renderTd } from './render-td';
import { renderSkeletonRow } from './render-skeleton-row';
import { renderError } from './render-error';
import { renderEmpty } from './render-empty';
import { renderGroupHeader } from './render-group-header';

/**
 * The default styled render set, as a GENERIC FACTORY rather than a constant.
 *
 * The individual slots are already generic (`renderTh<T>` etc.), but assembling
 * them into a plain `const tableRender: TableRender` pins the whole set to
 * `TableRender<unknown>` — and because each slot takes a `T`-typed context,
 * `TableRender<unknown>` is not assignable to `TableRender<Row>`. The adapter
 * would then be unusable with any concrete row type.
 *
 * A factory instantiates the slots at the call site instead. Mirrors
 * `makeStubRender<T>()` in @tickets/table. The returned object is cheap — nine
 * references to module-level functions — and the engine never keys off its
 * identity, so calling it inline in JSX is fine.
 *
 * Call it as `render={tableRender<Row>()}`.
 */
export function tableRender<T>(): TableRender<T> {
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
    empty: renderEmpty,
  };
}
