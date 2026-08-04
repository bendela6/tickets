import { forwardRef, type InputHTMLAttributes } from 'react';
import { axis, cn, HUES, over, TONE_HUE, variants, type Tone } from '../../style';
import { toggleRowClass } from '../toggle';
import type { ControlSize } from '../control';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  label: string;
  size?: ControlSize;
  /** Which ramp the on-state track and focus ring paint from. Defaults to `primary`. */
  tone?: Tone;
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
          `focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-${tone}-3`,
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
  { label, size = 'md', tone = 'primary', className, ...rest },
  ref,
) {
  const scale = TONE_HUE[tone];
  return (
    <label className={toggleRowClass({ size, className })}>
      <span className="relative inline-flex">
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className={trackClass({ scale, size })}
          {...rest}
        />
        <span aria-hidden className={thumbClass({ scale, className: cn(THUMB[size]) })} />
      </span>
      <span className="group-has-disabled:text-gray-9">{label}</span>
    </label>
  );
});
