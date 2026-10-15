import { memo, type ReactNode } from 'react';
import { cn } from '../../../../../style';
import type { LogLevel } from '../types';
import type { HighlightedLine } from '../utils/highlight';
import { clockTime } from '../utils/log-lines';
import { LogText } from './log-text';

/**
 * A row's time: the line's time in full (an ISO string), `null` where it
 * repeats the time of the row above, unset in a log with no times.
 */
export type RowTime = string | null | undefined;

/** What sits in a line's gutter: nothing, or the guide beside an entry's lines, in its tone. */
export type RowGutter = 'none' | LogLevel | 'plain';

// The whole row is washed for an error or a warning line, at the rungs the
// design gives them: red 3 for an error, orange (amber) 2 for a warning.
const WASH: Record<LogLevel, string> = {
  error: 'bg-red-3',
  warning: 'bg-orange-2',
};

// An entry's guide takes its first line's tone, as the design draws an
// error's stack trace in red.
const ENTRY_GUIDE: Record<Exclude<RowGutter, 'none'>, string> = {
  error: 'bg-red-6',
  warning: 'bg-orange-6',
  plain: 'bg-gray-6',
};

/**
 * The time column, 56 pixels: the line's time as the clock reads it. Out of
 * a selection, so a copied run of lines reads as the log printed them, not
 * with a time on every few.
 */
export function TimeCell({ time }: { time: string | null }) {
  const shown = time === null ? undefined : clockTime(time);
  return (
    <span className="text-11/20 text-gray-10 w-56 shrink-0 text-right select-none">
      {shown === undefined ? null : (
        <time dateTime={shown.iso} title={shown.iso}>
          {shown.clock}
        </time>
      )}
    </span>
  );
}

/** A 1 pixel line down a 20 pixel column: a section's guide, or an entry's. */
export function Guide({ className = 'bg-gray-6' }: { className?: string }) {
  return (
    <span aria-hidden className="flex w-20 shrink-0 justify-center self-stretch">
      <span className={cn('w-1', className)} />
    </span>
  );
}

/** The guides of the sections a row is in, one a level. */
export function Guides({ depth }: { depth: number }) {
  return Array.from({ length: depth }, (_, level) => <Guide key={level} />);
}

/** How a line's text is laid out: cut short with an ellipsis, or wrapped. */
export function textClass(wrap: boolean): string {
  return wrap ? 'break-all whitespace-pre-wrap' : 'overflow-hidden text-ellipsis whitespace-pre';
}

interface RowProps {
  /** The line's index in the log, said in the markup as `data-line`. */
  index: number;
  line: HighlightedLine;
  time: RowTime;
  /** How many sections it is in, a guide for each. */
  depth: number;
  wrap: boolean;
  /** The id of the line's text, which names a fold on it. */
  textId: string;
  /** Whether to wash the row in its level's tone. A section's first line is not washed. */
  wash?: boolean;
  /** Added to the row's classes: a section's first line's height. */
  className?: string;
  /** What sits in the gutter, between the guides and the text. */
  gutter: ReactNode;
  /** Before the text, after the gutter: a section's state. */
  lead?: ReactNode;
  /** The text's own classes, on top of the layout's. */
  textClassName?: string;
  /** After the text: an entry's count, a section's time. */
  trailing?: ReactNode;
}

/**
 * A row of the log: its time, the guides of the sections it is in, its
 * gutter, then its text as printed.
 */
export function Row({
  index,
  line,
  time,
  depth,
  wrap,
  textId,
  wash = true,
  className,
  gutter,
  lead,
  textClassName,
  trailing,
}: RowProps) {
  return (
    <div
      // The index and the level are said in the markup as well, for an app's
      // own styles and for finding a line, the first error say.
      data-line={index}
      data-level={line.level}
      className={cn('flex min-h-20 pr-12 pl-8', wash && line.level && WASH[line.level], className)}
    >
      {time !== undefined ? <TimeCell time={time} /> : null}
      <Guides depth={depth} />
      {gutter}
      {lead}
      <span id={textId} className={cn('min-w-0 flex-1', textClass(wrap), textClassName)}>
        <LogText spans={line.spans} />
      </span>
      {trailing}
    </div>
  );
}

interface LineRowProps {
  index: number;
  line: HighlightedLine;
  time: RowTime;
  depth: number;
  wrap: boolean;
  textId: string;
  /** The gutter: empty, or an entry's guide in its first line's tone. */
  gutter: RowGutter;
}

/**
 * A plain line, or one of an entry's lines under its first. Its props are
 * plain values, so a log that grows by a line draws that line, not every
 * line again.
 */
export const LineRow = memo(function LineRow({ gutter, ...row }: LineRowProps) {
  return (
    <Row
      {...row}
      gutter={
        gutter === 'none' ? (
          <span aria-hidden className="w-20 shrink-0" />
        ) : (
          <Guide className={ENTRY_GUIDE[gutter]} />
        )
      }
    />
  );
});
