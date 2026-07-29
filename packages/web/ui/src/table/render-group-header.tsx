import type { RenderGroupHeaderCtx } from '@tickets/table';

/**
 * A group's banner row. It does NOT take the column grid template: the header
 * is one continuous band, not a set of cells, so laying it out on the columns
 * would clip its content at the first column boundary.
 *
 * `role="row"` keeps the rowgroup's children uniform — a bare div between rows
 * makes the grid's accessibility tree invalid.
 */
export function renderGroupHeader({ header, style }: RenderGroupHeaderCtx) {
  return (
    <div
      role="row"
      className="flex items-center gap-2 border-b border-gray-6 bg-gray-1 px-4"
      style={{ ...style, right: 'auto', width: 'max-content', minWidth: '100%' }}
    >
      {header}
    </div>
  );
}
