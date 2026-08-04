import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { cn, TONE_HUE, type Tone } from '../../style';
import { toggleGlyphClass, toggleMarkClass, toggleRowClass, type ToggleSize } from '../toggle';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  label: string;
  size?: ToggleSize;
  /** Which ramp the checked fill and focus ring paint from. Defaults to `primary`. */
  tone?: Tone;
  indeterminate?: boolean;
};

// The box and its overlay marks must agree exactly — the tick is drawn to bleed
// over the input — so one table drives both.
const BOX: Record<ToggleSize, string> = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, size = 'md', tone = 'primary', indeterminate = false, className, ...rest },
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
    <label className={toggleRowClass({ size, className })}>
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
          type="checkbox"
          className={toggleMarkClass({
            fill: 'box',
            scale,
            // shrink-0 is required: as a flex item the input otherwise collapses
            // from 16px to ~9px wide (the switch/radio inputs already have it).
            className: cn('rounded-sm border-2', box),
          })}
          {...rest}
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
      <span className="group-has-disabled:text-gray-9">{label}</span>
    </label>
  );
});
