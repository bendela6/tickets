import { forwardRef, type InputHTMLAttributes } from 'react';
import { axis, cn, focusRing, HUES, over, TONE_HUE, variants } from '../../../style';
import { toggleRowClass } from '../toggle';
import { readOnlyMarkClass, type ControlProps, type ControlSize } from '../control';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

/**
 * The shared control contract over a boolean, plus the native attributes that
 * still make sense on a checkbox input (`name`, `id`, `aria-*`, `onBlur`).
 *
 * `value`/`onChange` are omitted from the native side and re-declared by
 * `ControlProps`: a caller drives this the way it drives every other control in
 * the package — with the value, not with the DOM event the input happens to
 * fire underneath.
 */
export type SwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'size' | 'type'
> &
  ControlProps<boolean> & {
    /**
     * Inline copy beside the track.
     *
     * Optional, because a switch is as often named from outside — a field row's
     * caption pointing at `id`, a settings row whose text is the row itself.
     * Requiring it only bought callers an empty string to satisfy the type,
     * which renders an empty text node and its gap.
     */
    label?: string;
  };

// A switch does not use toggleMarkClass: its resting state is a solid gray
// track rather than a bordered box, and the border only appears when disabled.
const trackClass = variants({
  base: 'peer m-0 shrink-0 appearance-none rounded-full border-0 bg-gray-7 transition-colors',
  config: {
    track: {
      default: 'on',
      options: {
        on: over(SCALE, (tone) => [
          `checked:bg-${tone}-9`,
          focusRing(tone),
          'disabled:cursor-not-allowed disabled:border-1 disabled:border-gray-6 disabled:bg-surface-inset',
        ]),
      },
    },
    // Track, thumb and travel are one geometry: travel = width - thumb - 2*inset.
    // 28/16 with a 12px thumb, 32/18 with 14px, 40/22 with 18px.
    size: {
      default: 'md',
      options: {
        sm: 'h-16 w-28',
        md: 'h-18 w-32',
        lg: 'h-22 w-40',
      },
    },
  },
});

const THUMB: Record<ControlSize, string> = {
  sm: 'size-12 peer-checked:translate-x-12',
  md: 'size-14 peer-checked:translate-x-14',
  lg: 'size-18 peer-checked:translate-x-18',
};

const thumbClass = variants({
  base: 'pointer-events-none absolute left-2 top-2 rounded-full transition-transform',
  config: {
    thumb: {
      default: 'default',
      options: {
        // Off thumb: white (light) / app (dark). On thumb in dark picks up the
        // ramp's contrast token so it reads against the filled track.
        default: over(SCALE, (tone) => [
          'bg-white dark:bg-gray-1',
          `dark:peer-checked:bg-${tone}-contrast`,
          'peer-disabled:bg-gray-6',
        ]),
      },
    },
  },
});

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, value, onChange, size = 'md', tone = 'primary', disabled, readOnly, className, ...rest },
  ref,
) {
  const scale = TONE_HUE[tone];
  return (
    <label
      className={toggleRowClass({
        size,
        // On the row rather than on the input: the row is what the pointer
        // actually lands on (the input sits inside its label), so this is the
        // only place `cursor-default` can beat the row's own `cursor-pointer`
        // and the only place that stops a click reaching the mark at all.
        className: cn(readOnly && readOnlyMarkClass, className),
      })}
    >
      <span className="relative inline-flex">
        <input
          {...rest}
          ref={ref}
          type="checkbox"
          role="switch"
          checked={value}
          disabled={disabled}
          // HTML's `readonly` does not apply to a checkbox — it is parsed and
          // ignored — so the refusal has to be stated in ARIA and enforced here.
          // Deliberately not `disabled`: a locked switch keeps its tab stop and
          // its place in form submission.
          aria-readonly={readOnly || undefined}
          onChange={(event) => {
            if (readOnly) return;
            // The event goes second, matching ControlProps: a caller that needs
            // the modifier keys can reach them, and everyone else ignores it.
            onChange(event.target.checked, event);
          }}
          className={trackClass({ scale, size })}
        />
        <span aria-hidden className={thumbClass({ scale, className: cn(THUMB[size]) })} />
      </span>
      {label ? <span className="group-has-disabled:text-gray-9">{label}</span> : null}
    </label>
  );
});
