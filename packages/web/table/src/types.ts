import type { CSSProperties, MouseEvent, ReactNode } from 'react';

export interface SortBy<F extends string = string> {
  field: F;
  direction: 'asc' | 'desc';
}

export type Renderer<V = unknown> = (props: { value: V; row: unknown }) => ReactNode;

export interface Column<T> {
  key: string;
  header: string;
  value?: (row: T) => unknown;
  render?: (row: T) => ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  as?: Renderer<any>;
  sortable?: boolean;
  /** Track size for this column. A number is pixels. A string is emitted into
   *  grid-template-columns verbatim, so `minmax(240px, 1fr)` and other track
   *  functions work — a flexible column cannot be expressed as a number.
   *  A width the user has dragged always wins over both. */
  width?: number | string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  resizable?: boolean;
}

export interface RenderRootCtx {
  children: ReactNode;
}

export interface RenderTheadCtx {
  children: ReactNode;
  gridTemplate: string;
}

export interface RenderThResize {
  startWidth: number;
  minWidth?: number;
  onWidthChange: (px: number) => void;
}

export interface RenderThCtx<T> {
  column: Column<T>;
  sort?: { direction: 'asc' | 'desc'; index: number };
  totalSorts: number;
  onSortClick: (e: MouseEvent) => void;
  resize?: RenderThResize;
}

export interface RenderTbodyCtx {
  children: ReactNode;
  totalSize: number;
}

export interface RenderTrCtx<T> {
  row: T;
  index: number;
  cells: ReactNode;
  gridTemplate: string;
  /** Virtualization positioning. MUST be applied or the row will not appear. */
  style: CSSProperties;
  onClick?: () => void;
}

export const ROW_HEIGHT = 40;

export interface RenderTdCtx<T> {
  column: Column<T>;
  row: T;
  /** Cell content from `column.render(row)` / `column.as({...})` / stringified `column.value(row)`. */
  children: ReactNode;
}

export interface RenderSkeletonRowCtx<T> {
  columns: Column<T>[];
  gridTemplate: string;
  /** The caller's data row height, so a placeholder is the same height as the
   *  real rows it stands in for (e.g. a compact density's 32px rather than
   *  the engine's ROW_HEIGHT default). */
  rowHeight: number;
}

export interface RenderErrorCtx {
  error: Error;
}

export interface TableRender<T = unknown> {
  root: (ctx: RenderRootCtx) => ReactNode;
  thead: (ctx: RenderTheadCtx) => ReactNode;
  th: (ctx: RenderThCtx<T>) => ReactNode;
  tbody: (ctx: RenderTbodyCtx) => ReactNode;
  tr: (ctx: RenderTrCtx<T>) => ReactNode;
  td: (ctx: RenderTdCtx<T>) => ReactNode;
  groupHeader: (ctx: RenderGroupHeaderCtx) => ReactNode;
  skeletonRow: (ctx: RenderSkeletonRowCtx<T>) => ReactNode;
  error: (ctx: RenderErrorCtx) => ReactNode;
}

/** Height of a group header row in pixels. Exported so the adapter styling and
 *  the virtualizer's size estimate cannot disagree — if they do, every row
 *  below the first group sits at the wrong offset. */
export const GROUP_ROW_HEIGHT = 34;

export interface TableGroup<T> {
  key: string;
  header: ReactNode;
  rows: T[];
}

/** One entry in the flattened, virtualized list. Group headers and data rows
 *  share a single virtualizer so the table keeps one scroll region. */
export type VirtualRow<T> =
  | { kind: 'group'; key: string; header: ReactNode }
  | { kind: 'row'; row: T; index: number };

export interface RenderGroupHeaderCtx {
  key: string;
  header: ReactNode;
  gridTemplate: string;
  /** Virtualization positioning. MUST be applied or the header will not appear. */
  style: CSSProperties;
}
