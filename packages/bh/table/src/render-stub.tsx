import type { TableRender } from './types';

/**
 * An unstyled skin for tests. Each slot draws a plain element marked with
 * `data-slot` (`th`, `tr`, `td`, `empty`, ...) and the context it was handed as
 * data attributes, so a test can check what the table asked for without any
 * real chrome.
 */
export function makeStubRender<T>(): TableRender<T> {
  return {
    root: ({ children, gridTemplate, rowCount, colCount }) => {
      return (
        <div
          data-slot="root"
          data-grid-template={gridTemplate}
          aria-rowcount={rowCount}
          aria-colcount={colCount}
        >
          {children}
        </div>
      );
    },
    thead: ({ children, gridTemplate, refreshing, filterRow }) => {
      return (
        <div
          data-slot="thead"
          data-grid-template={gridTemplate}
          data-refreshing={String(refreshing)}
        >
          {children}
          {filterRow}
        </div>
      );
    },
    filterRow: ({ columns, gridTemplate, pins }) => {
      return (
        <div data-slot="filter-row" data-grid-template={gridTemplate}>
          {columns.map((c) => {
            const pin = pins.get(c.key);
            return (
              <div
                key={c.key}
                data-slot="filter-cell"
                data-key={c.key}
                data-pin={pin ? `${pin.side}:${pin.offset}${pin.edge ? ':edge' : ''}` : ''}
              >
                {c.filter}
              </div>
            );
          })}
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
      trailing,
      children,
    }) => {
      return (
        <button
          {...focusProps}
          data-slot="th"
          data-pin={pin ? `${pin.side}:${pin.offset}${pin.edge ? ':edge' : ''}` : ''}
          data-pin-shift={pin ? String(pin.shift) : ''}
          data-trailing={String(Boolean(trailing))}
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
          {resize && (
            <span
              data-slot="resize"
              onDoubleClick={resize.onAutoFit}
              // A drag, reduced to its essentials: the real handle converts
              // pointer movement into a width, and this simply IS the width so
              // a test's arithmetic stays visible. Reporting it is what puts
              // the guideline on screen — see RenderThResize.onDragChange.
              onPointerDown={() => resize.onDragChange?.(resize.startWidth)}
              onPointerMove={(e) => resize.onDragChange?.(e.clientX)}
              onPointerUp={() => resize.onDragChange?.(null)}
            />
          )}
        </button>
      );
    },
    tbody: ({ children, totalSize, style, ref }) => {
      return (
        <div data-slot="tbody" data-total-size={totalSize} style={style} ref={ref}>
          {children}
        </div>
      );
    },
    tr: ({
      row,
      index,
      ariaRowIndex,
      cells,
      gridTemplate,
      style,
      onClick,
      overlay,
      selected,
      hasPinned,
      dimmed,
    }) => {
      return (
        <div
          data-slot="tr"
          data-index={index}
          aria-rowindex={ariaRowIndex}
          data-selected={String(Boolean(selected))}
          data-has-pinned={String(Boolean(hasPinned))}
          data-dimmed={String(Boolean(dimmed))}
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
    td: ({ column, index, children, focused, focusProps, pin, trailing }) => {
      return (
        <div
          {...focusProps}
          data-slot="td"
          data-pin={pin ? `${pin.side}:${pin.offset}${pin.edge ? ':edge' : ''}` : ''}
          data-pin-shift={pin ? String(pin.shift) : ''}
          data-trailing={String(Boolean(trailing))}
          data-focused={String(Boolean(focused))}
          data-key={column.key}
          data-column-index={index}
        >
          {children}
        </div>
      );
    },
    groupHeader: ({
      key,
      header,
      gridTemplate,
      style,
      collapsed,
      onToggle,
      sticky,
      belowFilterRow,
    }) => {
      return (
        <div
          // A distinct slot name, not a flag on the same one: the pinned copy
          // is a SECOND rendering of a band that is also in the row flow, so a
          // test counting bands would otherwise silently count one too many.
          data-slot={sticky ? 'sticky-group-header' : 'group-header'}
          data-key={key}
          data-grid-template={gridTemplate}
          data-collapsed={String(collapsed)}
          data-collapsible={onToggle ? 'true' : 'false'}
          data-below-filter-row={String(Boolean(belowFilterRow))}
          style={style}
        >
          {header}
          {onToggle ? (
            <button data-slot={sticky ? 'sticky-group-toggle' : 'group-toggle'} onClick={onToggle}>
              toggle
            </button>
          ) : null}
        </div>
      );
    },
    skeletonRow: ({ columns, gridTemplate, rowHeight, pins }) => {
      return (
        <div data-slot="skeleton-row" data-grid-template={gridTemplate} data-row-height={rowHeight}>
          {columns.map((c) => {
            const pin = pins.get(c.key);
            return (
              <div
                key={c.key}
                data-slot="skeleton-cell"
                data-key={c.key}
                // Spelled exactly as the `th` and `td` stubs spell it, so a
                // test can compare all four row shapes token for token.
                data-pin={pin ? `${pin.side}:${pin.offset}${pin.edge ? ':edge' : ''}` : ''}
                data-pin-shift={pin ? String(pin.shift) : ''}
              />
            );
          })}
        </div>
      );
    },
    error: ({ error, onRetry }) => {
      return (
        <div data-slot="error">
          {error.message}
          {onRetry ? (
            <button data-slot="error-retry" onClick={onRetry}>
              retry
            </button>
          ) : null}
        </div>
      );
    },
    empty: ({ filtered, onClearFilters }) => {
      return (
        <div data-slot="empty" data-filtered={String(filtered)}>
          {onClearFilters ? (
            <button data-slot="empty-clear" onClick={onClearFilters}>
              clear
            </button>
          ) : null}
        </div>
      );
    },
    tfoot: ({ columns, gridTemplate, bottomOffset, pins }) => {
      return (
        <div data-slot="tfoot" data-grid-template={gridTemplate} data-bottom-offset={bottomOffset}>
          {columns.map((c) => {
            const pin = pins.get(c.key);
            return (
              <div
                key={c.key}
                data-slot="tfoot-cell"
                data-key={c.key}
                data-pin={pin ? `${pin.side}:${pin.offset}${pin.edge ? ':edge' : ''}` : ''}
                data-pin-shift={pin ? String(pin.shift) : ''}
              >
                {c.footer}
              </div>
            );
          })}
        </div>
      );
    },
    hbar: ({ thumbWidth, thumbOffset, dragging, visible, thumbProps, trackProps }) => {
      return (
        <div {...trackProps} data-slot="table-hbar" data-visible={String(visible)}>
          <span
            {...thumbProps}
            data-slot="table-hbar-thumb"
            data-dragging={String(dragging)}
            data-thumb-width={thumbWidth}
            data-thumb-offset={thumbOffset}
          />
        </div>
      );
    },
    resizeGuide: ({ left, width, delta }) => {
      return (
        <div
          data-slot="table-resize-guide"
          data-left={left}
          data-width={width}
          data-delta={delta}
        />
      );
    },
    scrim: ({ kind, offset, bottom }) => {
      return (
        <div data-slot="table-scrim" data-kind={kind} data-offset={offset} data-bottom={bottom} />
      );
    },
    selectCell: ({ checked, indeterminate, isHeader, onChange, label }) => {
      return (
        <input
          type="checkbox"
          data-slot={isHeader ? 'select-all' : 'select-row'}
          data-indeterminate={String(Boolean(indeterminate))}
          aria-label={label}
          checked={checked}
          onChange={(e) => {
            return onChange(('shiftKey' in e.nativeEvent && e.nativeEvent.shiftKey) === true);
          }}
        />
      );
    },
  };
}
