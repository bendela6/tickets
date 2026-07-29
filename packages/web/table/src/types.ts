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
  skeletonRow: (ctx: RenderSkeletonRowCtx<T>) => ReactNode;
  error: (ctx: RenderErrorCtx) => ReactNode;
}
