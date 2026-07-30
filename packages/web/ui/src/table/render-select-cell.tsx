import type { RenderSelectCellCtx } from '@tickets/table';
import { Checkbox } from '../components/checkbox';

/**
 * The row-selection checkbox, in a row and above the column.
 *
 * Reuses the Checkbox primitive rather than hand-rolling a box, so a table's
 * ticks look like every other tick in the app — the same reasoning as
 * `renderEmpty` reusing ScreenState.
 *
 * `label=""` with an `aria-label` instead: a selection column shows no visible
 * text, but the input still needs a name or every checkbox in the table is
 * announced as an anonymous one. `gap-0` goes with it — Checkbox lays its mark
 * and its label out as a flex row, and an empty label would otherwise leave
 * the row's gap as dead space and push the box off-centre in a 40px column.
 *
 * `sm` because the box sits inside a 32–42px row next to 13px text; the
 * default 16px rung crowds it.
 *
 * The engine passes `shiftKey` through, and a range needs it, so the click
 * event is read for it rather than the change event's target state.
 */
export function renderSelectCell({ checked, indeterminate, onChange, label }: RenderSelectCellCtx) {
  return (
    <Checkbox
      label=""
      aria-label={label}
      className="gap-0"
      size="sm"
      checked={checked}
      indeterminate={indeterminate}
      onChange={(e) => {
        const native = e.nativeEvent;
        onChange('shiftKey' in native && native.shiftKey === true);
      }}
      // A checkbox inside a clickable row: without this, ticking a row would
      // also open its drawer behind it — the same trap LinkColumn and
      // ActionsColumn already guard against.
      onClick={(e) => e.stopPropagation()}
    />
  );
}
