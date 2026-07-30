import type { RenderGroupHeaderCtx } from '@tickets/table';
import { cn } from '../style';
import { Icon } from '../components/icon';

/**
 * A group's banner row. It does NOT take the column grid template: the header
 * is one continuous band, not a set of cells, so laying it out on the columns
 * would clip its content at the first column boundary.
 *
 * `role="row"` keeps the rowgroup's children uniform — a bare div between rows
 * makes the grid's accessibility tree invalid.
 *
 * The band's content then sits inside a `role="gridcell"` rather than directly
 * in the row. A `row` may only own cells, and axe reports a bare row as a
 * CRITICAL `aria-required-children` violation — which is how this was found.
 * No `aria-colspan`: the slot is handed a `gridTemplate` string, not a column
 * count, and `minmax(240px, 1fr)` cannot be counted by splitting on spaces.
 * The band reads as a one-cell row, which is honest.
 *
 * `px-4` is not an independent choice: it is the 16px the leading column's
 * content sits at (a row's 4px inset plus that column's 12px gutter — see
 * metrics.ts), so a group's label lines up with the keys beneath it.
 */
export function renderGroupHeader({ header, style, collapsed, onToggle }: RenderGroupHeaderCtx) {
  // The whole band is the hit target rather than just the chevron — a 34px
  // strip is a far easier thing to hit than a 12px glyph, and there is nothing
  // else in the band to click. When the caller has not opted into collapsing,
  // it stays a plain div so nothing suggests it is interactive.
  const Band = onToggle ? 'button' : 'div';
  return (
    <div
      role="row"
      className="border-b-1 border-gray-6 bg-gray-1"
      style={{ ...style, right: 'auto', width: 'max-content', minWidth: '100%' }}
    >
      {/* `h-full` so the cell still fills the band the virtualizer sized, which
          is what keeps the label vertically centred now that the flex box is
          one level down. */}
      <div role="gridcell" className="h-full">
        <Band
          {...(onToggle
            ? { type: 'button' as const, onClick: onToggle, 'aria-expanded': !collapsed }
            : {})}
          className={cn(
            'flex h-full w-full items-center gap-2.5 px-4 text-left',
            onToggle && 'cursor-pointer hover:bg-surface-inset',
          )}
        >
          {onToggle ? (
            // Rotation rather than two glyphs: the chevron turning is what
            // reads as the same control changing state.
            <span
              aria-hidden
              className={cn(
                'inline-flex shrink-0 text-gray-9 transition-transform',
                collapsed ? '-rotate-90' : 'rotate-0',
              )}
            >
              <Icon name="chevron-down" size="2xs" />
            </span>
          ) : null}
          {header}
        </Band>
      </div>
    </div>
  );
}
