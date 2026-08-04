import type { ReactNode } from 'react';
import { axis, cn, HUES, over, TONE_HUE, variants, type Tone } from '../../style';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

export type ProgressSize = 'sm' | 'md' | 'lg';

const trackClass = variants({
  base: 'flex-1 overflow-hidden rounded-full bg-surface-inset',
  config: {
    size: {
      default: 'md',
      options: {
        sm: 'h-2 min-w-28',
        md: 'h-4 min-w-36',
        lg: 'h-6 min-w-48',
      },
    },
  },
});

const fillClass = variants({
  base: 'h-full rounded-full',
  config: {
    fill: {
      default: 'solid',
      options: {
        solid: over(SCALE, (tone) => `bg-${tone}-9`),
      },
    },
  },
});

// The label and its trailing figure sit on the same rung as the bar.
const TEXT: Record<ProgressSize, string> = {
  sm: 'text-10',
  md: 'text-11',
  lg: 'text-12/17',
};

/**
 * A bar showing how far along something is, as a percentage.
 *
 * Deliberately dumb: it takes a percent and a tone and draws them. It knows
 * nothing about budgets, caps or thresholds — a caller with a token budget or
 * a spend limit converts to a percent and picks the tone itself, because only
 * that caller knows what "nearly out" means for its own quantity.
 */
export function Progress({
  value,
  tone = 'primary',
  size = 'md',
  label,
  trailing,
  className,
  trackClassName,
}: {
  /** Percent complete, 0–100. Values outside the range are clamped. */
  value: number;
  tone?: Tone;
  size?: ProgressSize;
  label?: ReactNode;
  trailing?: ReactNode;
  /** Layout/spacing on the outer flex wrapper (label + track + trailing). */
  className?: string;
  /** Overrides the track's own sizing (e.g. `min-w-*`, `h-*`) — twMerge resolves conflicts with the default. */
  trackClassName?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  const figure = cn('font-mono text-gray-11 tabular-nums', TEXT[size]);
  return (
    <div className={cn('flex items-center gap-8', className)}>
      {label != null ? <span className={figure}>{label}</span> : null}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className={trackClass({ size, className: trackClassName })}
      >
        <div className={fillClass({ scale: TONE_HUE[tone] })} style={{ width: `${pct}%` }} />
      </div>
      {trailing != null ? <span className={figure}>{trailing}</span> : null}
    </div>
  );
}
