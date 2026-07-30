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
    th: ({
      column,
      index,
      sort,
      totalSorts,
      onSortClick,
      resize,
      focused,
      focusProps,
      pin,
      children,
    }) => {
      return (
        <button
          {...focusProps}
          data-slot="th"
          data-pin={pin ? `${pin.side}:${pin.offset}${pin.edge ? ':edge' : ''}` : ''}
          data-focused={String(Boolean(focused))}
          data-key={column.key}
          data-column-index={index}
          data-sort-direction={sort?.direction ?? ''}
          data-sort-index={sort?.index ?? ''}
          data-total-sorts={totalSorts}
          data-resizable={resize ? 'true' : 'false'}
          data-start-width={resize?.startWidth ?? ''}
          onClick={onSortClick}
        >
          {children ?? column.header}
          {resize && <span data-slot="resize" onDoubleClick={resize.onAutoFit} />}
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
    tr: ({ row, index, cells, gridTemplate, style, onClick, overlay, selected, hasPinned }) => {
      return (
        <div
          data-slot="tr"
          data-index={index}
          data-selected={String(Boolean(selected))}
          data-has-pinned={String(Boolean(hasPinned))}
          data-row-id={(row as { id?: string }).id ?? ''}
          data-grid-template={gridTemplate}
          style={style}
          onClick={onClick}
        >
          {cells}
          {overlay ? <span data-slot="row-overlay">{overlay}</span> : null}
        </div>
      );
    },
    td: ({ column, index, children, focused, focusProps, pin }) => {
      return (
        <div
          {...focusProps}
          data-slot="td"
          data-pin={pin ? `${pin.side}:${pin.offset}${pin.edge ? ':edge' : ''}` : ''}
          data-focused={String(Boolean(focused))}
          data-key={column.key}
          data-column-index={index}
        >
          {children}
        </div>
      );
    },
    groupHeader: ({ key, header, gridTemplate, style, collapsed, onToggle }) => {
      return (
        <div
          data-slot="group-header"
          data-key={key}
          data-grid-template={gridTemplate}
          data-collapsed={String(collapsed)}
          data-collapsible={onToggle ? 'true' : 'false'}
          style={style}
        >
          {header}
          {onToggle ? (
            <button data-slot="group-toggle" onClick={onToggle}>
              toggle
            </button>
          ) : null}
        </div>
      );
    },
    skeletonRow: ({ columns, gridTemplate, rowHeight }) => {
      return (
        <div data-slot="skeleton-row" data-grid-template={gridTemplate} data-row-height={rowHeight}>
          {columns.map((c) => {
            return <div key={c.key} data-slot="skeleton-cell" />;
          })}
        </div>
      );
    },
    error: ({ error }) => <div data-slot="error">{error.message}</div>,
    empty: ({ filtered }) => <div data-slot="empty" data-filtered={String(filtered)} />,
    selectCell: ({ checked, indeterminate, isHeader, onChange, label }) => {
      return (
        <input
          type="checkbox"
          data-slot={isHeader ? 'select-all' : 'select-row'}
          data-indeterminate={String(Boolean(indeterminate))}
          aria-label={label}
          checked={checked}
          onChange={(e) =>
            onChange(('shiftKey' in e.nativeEvent && e.nativeEvent.shiftKey) === true)
          }
        />
      );
    },
  };
}
