import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn, HUE_TONES, STEP, TONE_SCALE, variants, type Tone } from '../../style';
import { toggleRowClass, type ToggleSize } from '../toggle';

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  label: string;
  size?: ToggleSize;
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
      params: { scale: { default: TONE_SCALE.primary, values: HUE_TONES } },
      options: ({ scale }: { scale?: string }) => ({
        on: [
          `checked:bg-${scale}-${STEP.solid}`,
          `focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-${scale}-${STEP.focusRing}`,
          'disabled:cursor-not-allowed disabled:border disabled:border-gray-6 disabled:bg-surface-inset',
        ],
      }),
    },
    // Track, thumb and travel are one geometry: travel = width - thumb - 2*inset.
    // 28/16 with a 12px thumb, 32/18 with 14px, 40/22 with 18px.
    size: {
      default: 'md',
      options: {
        sm: 'h-4 w-7',
        md: 'h-4.5 w-8',
        lg: 'h-5.5 w-10',
      },
    },
  },
});

const THUMB: Record<ToggleSize, string> = {
  sm: 'size-3 peer-checked:translate-x-3',
  md: 'size-3.5 peer-checked:translate-x-3.5',
  lg: 'size-4.5 peer-checked:translate-x-4.5',
};

const thumbClass = variants({
  base: 'pointer-events-none absolute left-0.5 top-0.5 rounded-full transition-transform',
  config: {
    thumb: {
      default: 'default',
      params: { scale: { default: TONE_SCALE.primary, values: HUE_TONES } },
      options: ({ scale }: { scale?: string }) => ({
        // Off thumb: white (light) / app (dark). On thumb in dark picks up the
        // ramp's contrast token so it reads against the filled track.
        default: [
          'bg-white dark:bg-gray-1',
          `dark:peer-checked:bg-${scale}-${STEP.contrast}`,
          'peer-disabled:bg-gray-6',
        ],
      }),
    },
  },
});

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, size = 'md', tone = 'primary', className, ...rest },
  ref,
) {
  const scale = TONE_SCALE[tone];
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
