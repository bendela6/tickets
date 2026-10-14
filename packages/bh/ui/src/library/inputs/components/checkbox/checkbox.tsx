import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes } from 'react';
import { cn, TONE_HUE } from '../../../../style';
import { toggleGlyphClass, toggleMarkClass, toggleRowClass } from '../../parts/toggle';
import {
  CONTROL_LADDER,
  readOnlyMarkClass,
  type ControlProps,
  type ControlSize,
} from '../../contract';

type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'size' | 'type'
> &
  ControlProps<boolean> & {
    /**
     * The text beside the box; leave it out when `aria-label` or a
     * `<label htmlFor>` names the box instead.
     *
     * Optional, because plenty of checkboxes are named from outside — a table's
     * selection column and a field row both label the control elsewhere and
     * pass `aria-label` or point a `<label htmlFor>` at `id`. Omitting it
     * renders no span at all, rather than an empty one whose only effect is to
     * leave the row's gap as dead space beside the mark.
     */
    label?: string;
    /**
     * A line under the label, saying what checking it does: muted, and the
     * box's description, so a screen reader reads it after the name.
     *
     * Drawn as RadioGroup draws an option's: the label in 500 over a 12-pixel
     * line, and the box beside the label's line. Plain text, as `label` is.
     */
    description?: string;
    /**
     * Draws a dash for a mixed state, over whatever `value` holds.
     *
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

/** One yes-or-no choice: a box, with an optional label, and a line of description under it. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    description,
    value,
    onChange,
    size = 'md',
    tone = 'primary',
    readOnly = false,
    indeterminate = false,
    className,
    'aria-describedby': ariaDescribedBy,
    'aria-labelledby': ariaLabelledBy,
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
  const uid = useId();
  const labelId = `${uid}label`;
  const descriptionId = `${uid}description`;
  const described = Boolean(description);
  const box = BOX[size];
  const scale = TONE_HUE[tone];

  const mark = (
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
        // over the attributes this component owns.
        {...rest}
        type="checkbox"
        checked={value}
        // The `<label>` around the box would name it by all its text, the
        // description included. With a description, the label alone names it
        // and the line describes it, ahead of whatever the caller's ids point
        // at (a form field's help or its error), so a screen reader says the
        // choice, then what it does.
        aria-labelledby={ariaLabelledBy ?? (described && label !== undefined ? labelId : undefined)}
        aria-describedby={
          [described ? descriptionId : undefined, ariaDescribedBy].filter(Boolean).join(' ') ||
          undefined
        }
        // HTML's `readonly` does not apply to a checkbox — the platform
        // ignores it outright — so the state is announced through ARIA and
        // enforced by refusing to emit. `disabled` would be the wrong reach:
        // it drops the tab stop and the submitted value, both of which a
        // field locked by permission still owes.
        aria-readonly={readOnly || undefined}
        onChange={(event) => {
          if (readOnly) {
            return;
          }
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
          className: cn('rounded-4 border-1.5', box),
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
        <path d="M3 6h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
  const text =
    label !== undefined ? (
      <span id={labelId} className={cn(described && 'font-500', 'group-has-disabled:text-gray-9')}>
        {label}
      </span>
    ) : null;

  return (
    <label
      // The read-only treatment goes on the ROW, not the input: the cursor it
      // has to cancel (`cursor-pointer`) lives here, and a label forwards its
      // clicks to the control it wraps, so blocking pointer events on the
      // input alone would still leave the text clickable. A described row
      // hangs from its first line, so the box sits by the label, not between
      // the two lines.
      className={toggleRowClass({
        size,
        className: cn(described && 'items-start', readOnly && readOnlyMarkClass, className),
      })}
    >
      {described ? (
        <>
          {/* One line tall, so the box centres on the label's line whatever
              the size's leading is. */}
          <span className="flex h-[1lh] shrink-0 items-center">{mark}</span>
          <span className="flex min-w-0 flex-col">
            {text}
            {/* Its own weight, so a group that sets its labels in 500 through
                the row leaves the line as it is. */}
            <span
              id={descriptionId}
              className="text-12/17 font-400 text-gray-11 group-has-disabled:text-gray-9"
            >
              {description}
            </span>
          </span>
        </>
      ) : (
        <>
          {mark}
          {text}
        </>
      )}
    </label>
  );
});
