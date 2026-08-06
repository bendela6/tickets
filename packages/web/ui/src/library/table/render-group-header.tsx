import { GROUP_ROW_HEIGHT, type RenderGroupHeaderCtx } from '@tickets/table';
import { cn } from '../../style';
import { Icon } from '../primitives/components/icon';

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
 * `px-16` is not an independent choice: it is the 16px the leading column's
 * content sits at (a row's 4px inset plus that column's 12px gutter — see
 * metrics.ts), so a group's label lines up with the keys beneath it.
 */
export function renderGroupHeader({
  key,
  gridTemplate,
  header,
  style,
  collapsed,
  onToggle,
  sticky,
}: RenderGroupHeaderCtx) {
  // A `button` only when there is something to toggle, so a band that cannot
  // collapse does not advertise itself as interactive.
  const Band = onToggle ? 'button' : 'div';
  if (sticky) {
    return (
      <div
        // `h-0` is the load-bearing part. A sticky element is only sticky
        // within its own containing block, so this cannot be wrapped in a
        // zero-height box — it has to BE the sticky box and let the band
        // overflow it, or it would unstick the moment it scrolled past its own
        // height. Height zero also keeps it out of flow height, so the rows
        // below are not pushed down by it.
        //
        // `top-36` is the column header's height (HEAD_HEIGHT), so this lands
        // directly beneath it rather than under it.
        //
        // `z-9`, below the header's `z-10` and above the rows: it must cover
        // rows sliding past and be covered by the header.
        className="sticky top-36 z-9 h-0"
        // A duplicate of a band that is already in the row flow. Announcing it
        // would read the same group twice. The real band stays in the
        // rowgroup, which is what a screen reader walks.
        //
        // Note what this must NOT be: `pointer-events-none`. The band is opaque
        // and sits over a row, so letting clicks through would open whatever
        // row happens to be underneath — a click on something that looks like a
        // group header doing something entirely unrelated.
        aria-hidden
      >
        <Band
          {...(onToggle
            ? {
                type: 'button' as const,
                onClick: onToggle,
                // Clickable but never tabbable. It sits inside `aria-hidden`,
                // and a focusable descendant of a hidden subtree is both an axe
                // violation and a genuine trap — Tab would land somewhere a
                // screen reader insists does not exist. Keyboard users reach
                // the real band instead.
                tabIndex: -1,
              }
            : {})}
          className={cn(
            'flex w-full items-center gap-10 border-b-1 border-gray-6 bg-gray-1 px-16 text-left',
            onToggle && 'cursor-pointer hover:bg-surface-inset',
          )}
          // The one place a band's height is stated rather than handed over by
          // the virtualizer, since this copy is outside the virtual list.
          style={{ height: GROUP_ROW_HEIGHT }}
        >
          {onToggle ? (
            <span
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
    );
  }
  return renderBand({ header, style, collapsed, onToggle, key, gridTemplate });
}

function renderBand({ header, style, collapsed, onToggle }: RenderGroupHeaderCtx) {
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
            'flex h-full w-full items-center gap-10 px-16 text-left',
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
