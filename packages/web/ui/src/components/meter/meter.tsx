import type { ReactNode } from 'react';
import { cn, HUE_TONES, STEP, TONE_SCALE, variants, type Tone } from '../../style';

export type MeterSize = 'sm' | 'md' | 'lg';

const meterTrackClass = variants({
  base: 'flex-1 overflow-hidden rounded-full bg-surface-inset',
  config: {
    size: {
      default: 'md',
      options: {
        sm: 'h-0.5 min-w-7',
        md: 'h-1 min-w-9',
        lg: 'h-1.5 min-w-12',
      },
    },
  },
});

// The fill takes the ramp's solid rung directly rather than the first token of
// toneClasses(t, 'solid'), which only worked because that string happens to
// start with its bg-*.
const meterFillClass = variants({
  base: 'h-full rounded-full',
  config: {
    fill: {
      default: 'solid',
      params: { scale: { default: TONE_SCALE.primary, values: HUE_TONES } },
      options: ({ scale }: { scale?: string }) => ({
        solid: `bg-${scale}-${STEP.solid}`,
      }),
    },
  },
});

// The label and its trailing figure sit on the same rung as the bar.
const TEXT: Record<MeterSize, string> = {
  sm: 'text-[10px]',
  md: 'text-[11px]',
  lg: 'text-meta',
};

export function Meter({
  value,
  max = 100,
  tone = 'primary',
  size = 'md',
  warnAt,
  dangerAt,
  label,
  trailing,
  className,
  trackClassName,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  size?: MeterSize;
  warnAt?: number;
  dangerAt?: number;
  label?: ReactNode;
  trailing?: ReactNode;
  /** Layout/spacing on the outer flex wrapper (label + track + trailing). */
  className?: string;
  /** Overrides the track's own sizing (e.g. `min-w-*`, `h-*`) — twMerge resolves conflicts with the default. */
  trackClassName?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  // Thresholds override the caller's tone: a meter past its danger mark reads
  // as danger regardless of what it was asked to be.
  const effective: Tone =
    dangerAt != null && value >= dangerAt
      ? 'danger'
      : warnAt != null && value >= warnAt
        ? 'warning'
        : tone;
  const figure = cn('font-mono text-gray-11 tabular-nums', TEXT[size]);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label != null ? <span className={figure}>{label}</span> : null}
      <div
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={meterTrackClass({ size, className: trackClassName })}
      >
        <div
          className={meterFillClass({ scale: TONE_SCALE[effective] })}
          style={{ width: `${pct}%` }}
        />
      </div>
      {trailing != null ? <span className={figure}>{trailing}</span> : null}
    </div>
  );
}
