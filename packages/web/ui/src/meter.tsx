import type { ReactNode } from 'react';
import { cn } from './cn';
import { toneClasses, type Tone } from './tones';

export function Meter({
  value,
  max = 100,
  tone = 'primary',
  warnAt,
  dangerAt,
  label,
  trailing,
  className,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  warnAt?: number;
  dangerAt?: number;
  label?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const effective: Tone =
    dangerAt != null && value >= dangerAt
      ? 'danger'
      : warnAt != null && value >= warnAt
        ? 'warning'
        : tone;
  // toneClasses(t,'solid') is always `bg-<base> text-on-<base>` (verified for
  // every tone in tones.generated.ts) — the fill only needs the bg, so take
  // the first class rather than duplicating the bg-* value here.
  const fillBg = toneClasses(effective, 'solid').split(' ')[0];
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label != null ? (
        <span className="font-mono text-[11px] text-ink-2 tabular-nums">{label}</span>
      ) : null}
      <div
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-1 min-w-9 flex-1 overflow-hidden rounded-full bg-inset"
      >
        <div className={cn('h-full rounded-full', fillBg)} style={{ width: `${pct}%` }} />
      </div>
      {trailing != null ? (
        <span className="font-mono text-[11px] text-ink-2 tabular-nums">{trailing}</span>
      ) : null}
    </div>
  );
}
