import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { cn, TONE_HUE } from '../../../../style';
import { toggleGlyphClass, toggleMarkClass, toggleRowClass } from '../../parts/toggle';
import { CONTROL_LADDER, readOnlyMarkClass, type ControlProps, type ControlSize } from '../../contract';

type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'size' | 'type'
> &
  ControlProps<boolean> & {
    /**
     * The text beside the box. Optional, because plenty of checkboxes are named
     * from outside — a table's selection column and a field row both label the
     * control elsewhere and pass `aria-label` or point a `<label htmlFor>` at
     * `id`. Omitting it renders no span at all, rather than an empty one whose
     * only effect is to leave the row's gap as dead space beside the mark.
     */
    label?: string;
    /**
     * The third display state, pushed onto the DOM node rather than expressed
     * through `value`: `indeterminate` is an IDL property with no attribute, so
     * only an effect can set it. It is orthogonal to the value — a half-checked
     * box still submits whatever `value` says — which is why it stays its own
     * prop and not a third member of the value domain.
     */
    indeterminate?: boolean;
  };

// The box and its overlay marks must agree exactly — the tick is drawn to bleed
// over the input — so one table drives both. That table is the LADDER's, not a
// local copy: these three values were spelled out here and matched
// `CONTROL_LADDER.*.mark` by coincidence, which is drift waiting to happen. A
// checkbox next to a md Input has to be the mark height the ladder names for md.
const BOX: Record<ControlSize, string> = {
  xs: CONTROL_LADDER.xs.mark,
  md: CONTROL_LADDER.md.mark,
  lg: CONTROL_LADDER.lg.mark,
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    value,
    onChange,
    size = 'md',
    tone = 'primary',
    readOnly = false,
    indeterminate = false,
    className,
    ...rest
  },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (inner.current) {
      inner.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  const box = BOX[size];
  const scale = TONE_HUE[tone];
  return (
    <label
      // The read-only treatment goes on the ROW, not the input: the cursor it
      // has to cancel (`cursor-pointer`) lives here, and a label forwards its
      // clicks to the control it wraps, so blocking pointer events on the
      // input alone would still leave the text clickable.
      className={toggleRowClass({ size, className: cn(readOnly && readOnlyMarkClass, className) })}
    >
      <span className={cn('relative inline-flex shrink-0', box)}>
        <input
          ref={(node) => {
            inner.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          // Passthrough first, so nothing a caller happens to spread can win
          // over the four attributes this component owns.
          {...rest}
          type="checkbox"
          checked={value}
          // HTML's `readonly` does not apply to a checkbox — the platform
          // ignores it outright — so the state is announced through ARIA and
          // enforced by refusing to emit. `disabled` would be the wrong reach:
          // it drops the tab stop and the submitted value, both of which a
          // field locked by permission still owes.
          aria-readonly={readOnly || undefined}
          onChange={(event) => {
            if (readOnly) return;
            // The event goes second so a caller that needs the modifier keys
            // can still reach them — the table's select cell extends a row
            // range off `shiftKey`, and a value-only signature would have
            // broken that silently rather than loudly.
            onChange(event.target.checked, event);
          }}
          className={toggleMarkClass({
            fill: 'box',
            scale,
            // shrink-0 is required: as a flex item the input otherwise collapses
            // from 16px to ~9px wide (the switch/radio inputs already have it).
            className: cn('rounded-4 border-2', box),
          })}
        />
        {/* Checkmark / dash rendered as overlays (not bg-image) so they never
            conflict with the checked fill under tailwind-merge.
            Kept as hand-rolled inline SVGs rather than <Icon name="check"/> /
            <Icon name="minus"/>: the registry's "check"/"minus" glyphs are drawn
            on a 16-unit viewBox sized for a standalone 14-16px icon, while these
            are purpose-fit to this control's 12-unit viewBox + 1.5px stroke +
            p-px overlay geometry. Swapping in the registry glyphs would shift
            the mark's proportions inside the box. */}
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={toggleGlyphClass({
            scale,
            className: cn('inset-0 hidden p-px peer-checked:block', box),
          })}
        >
          <path
            d="M2.5 6.5 5 9l4.5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={toggleGlyphClass({
            scale,
            className: cn('inset-0 hidden p-px peer-indeterminate:block', box),
          })}
        >
          <path
            d="M3 6h6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {label !== undefined && <span className="group-has-disabled:text-gray-9">{label}</span>}
    </label>
  );
});
