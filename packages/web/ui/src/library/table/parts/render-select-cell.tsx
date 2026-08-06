import type { RenderSelectCellCtx } from '@tickets/table';
import { Checkbox } from '../../inputs/components/checkbox';

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
 * and its label out as a flex row. The `label=""` and `gap-0` this used to
 * carry are gone: Checkbox's label is optional now, so an unlabelled box
 * renders one child and the row's gap has nothing to pad.
 *
 * `sm` because the box sits inside a 32–42px row next to 13px text; the
 * default 16px rung crowds it.
 *
 * The engine passes `shiftKey` through, and a range needs it, so the change
 * event is read for it rather than the checkbox's new value.
 */
export function renderSelectCell({ checked, indeterminate, onChange, label }: RenderSelectCellCtx) {
  return (
    <Checkbox
      aria-label={label}
      size="xs"
      value={checked}
      indeterminate={indeterminate}
      onChange={(_checked, event) => {
        // The value is not what this cell wants — the engine needs to know
        // whether the click extended a range, which only the event carries.
        // This is the call site that put the second argument in ControlProps:
        // under a value-only signature the modifier is unreachable and range
        // selection stops working without failing to compile.
        const native = event?.nativeEvent;
        onChange(!!native && 'shiftKey' in native && native.shiftKey === true);
      }}
      // A checkbox inside a clickable row: without this, ticking a row would
      // also open its drawer behind it — the same trap LinkColumn and
      // ActionsColumn already guard against.
      onClick={(e) => e.stopPropagation()}
    />
  );
}
