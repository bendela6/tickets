import type { TableRender } from './types';

/**
 * Test-only stub render. Each slot emits a deterministic DOM element with a
 * `data-slot` marker so tests can assert which slots fire and what props they
 * receive. Has zero styling — verifies engine logic without coupling to chrome.
 */
export function makeStubRender<T>(): TableRender<T> {
  return {
    root: ({ children }) => <div data-slot="root">{children}</div>,
    thead: ({ children, gridTemplate }) => {
      return (
        <div data-slot="thead" data-grid-template={gridTemplate}>
          {children}
        </div>
      );
    },
    th: ({ column, sort, totalSorts, onSortClick, resize }) => {
      return (
        <button
          data-slot="th"
          data-key={column.key}
          data-sort-direction={sort?.direction ?? ''}
          data-sort-index={sort?.index ?? ''}
          data-total-sorts={totalSorts}
          data-resizable={resize ? 'true' : 'false'}
          onClick={onSortClick}
        >
          {column.header}
          {resize && <span data-slot="resize" />}
        </button>
      );
    },
    tbody: ({ children, totalSize }) => {
      return (
        <div data-slot="tbody" data-total-size={totalSize}>
          {children}
        </div>
      );
    },
    tr: ({ row, index, cells, gridTemplate, style, onClick }) => {
      return (
        <div
          data-slot="tr"
          data-index={index}
          data-row-id={(row as { id?: string }).id ?? ''}
          data-grid-template={gridTemplate}
          style={style}
          onClick={onClick}
        >
          {cells}
        </div>
      );
    },
    td: ({ column, children }) => {
      return (
        <div data-slot="td" data-key={column.key}>
          {children}
        </div>
      );
    },
    skeletonRow: ({ columns, gridTemplate }) => {
      return (
        <div data-slot="skeleton-row" data-grid-template={gridTemplate}>
          {columns.map((c) => {
            return <div key={c.key} data-slot="skeleton-cell" />;
          })}
        </div>
      );
    },
    error: ({ error }) => <div data-slot="error">{error.message}</div>,
  };
}
