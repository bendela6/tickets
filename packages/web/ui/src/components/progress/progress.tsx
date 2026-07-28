import type { ReactNode } from 'react';
import { cn, over, TONE, TONE_SCALE, variants, type Tone } from '../../style';

export type ProgressSize = 'sm' | 'md' | 'lg';

const trackClass = variants({
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

const fillClass = variants({
  base: 'h-full rounded-full',
  config: {
    fill: {
      default: 'solid',
      options: {
        solid: over(TONE, (t) => `bg-${t.solid}`),
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
    <div className={cn('flex items-center gap-2', className)}>
      {label != null ? <span className={figure}>{label}</span> : null}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className={trackClass({ size, className: trackClassName })}
      >
        <div className={fillClass({ scale: TONE_SCALE[tone] })} style={{ width: `${pct}%` }} />
      </div>
      {trailing != null ? <span className={figure}>{trailing}</span> : null}
    </div>
  );
}
