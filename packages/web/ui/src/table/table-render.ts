import type { TableRender } from '@tickets/table';
import { renderRoot } from './render-root';
import { renderThead } from './render-thead';
import { renderTh } from './render-th';
import { renderTbody } from './render-tbody';
import { renderTr } from './render-tr';
import { renderTd } from './render-td';
import { renderSkeletonRow } from './render-skeleton-row';
import { renderError } from './render-error';

// groupHeader is added in Task 7 — the type will complain until then.
export const tableRender: TableRender = {
  root: renderRoot,
  thead: renderThead,
  th: renderTh,
  tbody: renderTbody,
  tr: renderTr,
  td: renderTd,
  skeletonRow: renderSkeletonRow,
  error: renderError,
};
