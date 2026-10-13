import type { ReactNode } from 'react';
import { cn, TONE_HUE, type Tone } from '../../../../style';

// A share of a whole, as a bar with its name, its percent and a line saying
// what it is: a gateway's machine and storage meters and a media dashboard's
// disk bar, which each drew one by hand on Progress. The dashboard's had marks
// for its thresholds too, and no name at its left (the card's title said it),
// hence `marks` and `showLabel`.
//
// Not built on Progress, though it draws the same track and fill: Progress is
// a `progressbar`, how far along something is, and a share of a disk or of
// memory is a measurement within a known range, which is a `meter`. The fill's
// class is picked by hue as ScreenState's disc is; Progress's variants already
// put every `bg-*-9` in the safelist.

/** A threshold drawn on a Meter's bar. */
export interface MeterMark {
  /** Where it sits, 0 to 1 along the bar from its left end. */
  at: number;
  /** What it is, as the mark's tooltip. Say it in the caption too: a hairline is not a number. */
  label: string;
}

// Past 80 % a share wants watching; past 90 % it wants something done.
const WARNING_AT = 0.8;
const DANGER_AT = 0.9;

/**
 * The tone a Meter takes for a share when it is given none: `warning` from
 * 0.8, `danger` from 0.9, `primary` under.
 *
 * Exported so what else shows the same share (a dot in the nav, a pill) takes
 * the same tone as its bar.
 *
 * @param fraction The share, 0 to 1.
 */
export function meterTone(fraction: number): Tone {
  if (fraction >= DANGER_AT) {
    return 'danger';
  }
  return fraction >= WARNING_AT ? 'warning' : 'primary';
}

/** 0 to 100, from a share that may be out of range or not a number at all. */
function toPercent(fraction: number): number {
  if (!Number.isFinite(fraction)) {
    return 0;
  }
  return Math.min(100, Math.max(0, fraction * 100));
}

/** A decimal while it is small enough to matter, and none for nothing at all. */
function formatPercent(percent: number): string {
  return percent > 0 && percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
}

/**
 * A share of a whole as a bar: its name on the left, its percent on the
 * right, a caption under it, toned by how full it is.
 */
export function Meter({
  label,
  fraction,
  caption,
  tone,
  marks = [],
  showLabel = true,
}: {
  /** What the bar measures. Drawn at its left, and its name for a screen reader. */
  label: string;
  /** The share, 0 to 1. One out of range is clamped, and one that is not a number is 0. */
  fraction: number;
  /** A line under the bar saying what it counts: "6.1 GB used of 16 GB". */
  caption?: ReactNode;
  /** The fill's tone. Unset, it is `meterTone(fraction)`: warning from 80 %, danger from 90 %. */
  tone?: Tone;
  /** Thresholds drawn as hairlines on the bar. */
  marks?: readonly MeterMark[];
  /**
   * Draws the label at the bar's left. `false` keeps it as the bar's name
   * only, for a card whose title already says what the bar is.
   */
  showLabel?: boolean;
}) {
  const percent = toPercent(fraction);
  const shown = formatPercent(percent);
  const hue = TONE_HUE[tone ?? meterTone(percent / 100)];
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 items-center gap-8">
        {showLabel ? (
          <span className="text-12/17 text-gray-12 w-88 shrink-0 truncate">{label}</span>
        ) : null}
        <div className="relative min-w-48 flex-1">
          <div
            role="meter"
            aria-label={label}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={shown}
            className="bg-surface-inset h-6 overflow-hidden rounded-full"
          >
            <div className={`h-full rounded-full bg-${hue}-9`} style={{ width: `${percent}%` }} />
          </div>
          {marks.map((mark) => {
            return (
              <span
                key={mark.label}
                aria-hidden
                title={mark.label}
                style={{ left: `${toPercent(mark.at)}%` }}
                className="bg-gray-12/70 absolute inset-y-0 w-1 rounded-full"
              />
            );
          })}
        </div>
        <span className="text-12 text-gray-11 w-40 shrink-0 text-right font-mono tabular-nums">
          {shown}
        </span>
      </div>
      {/* Under the bar, not the label: 88 for the label, 8 for the gap. */}
      {caption != null ? (
        <p className={cn('text-11/15 text-gray-11', showLabel && 'pl-96')}>{caption}</p>
      ) : null}
    </div>
  );
}
