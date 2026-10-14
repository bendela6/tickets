// A log to read: any app's, line by line, in the page's monospace. Each line is
// read once (./utils/highlight): its ANSI colours drawn in the page's tones, its
// escape codes dropped, then the highlight rules run over its plain text. The
// rules are data, the defaults first and the app's own on top, so the view
// knows nothing of what the app logs.
//
// A multi-line entry, a line and what is indented under it as a stack trace is
// (./utils/entries), folds under its first line, for a log with no sections.
//
// This is the line layer the rest of LogView sits on: sections that fold and
// follow the end (GW-13.1) wrap these rows, and the toolbar, find and the
// counts read the same highlighted lines.

import { useId, useMemo, useState, type ReactNode } from 'react';
import { cn } from '../../../../style';
import { EntryToggle } from './parts/entry-toggle';
import { LogText } from './parts/log-text';
import type { LogLevel, LogLine, LogRule } from './types';
import { groupLogEntries, type LogEntry } from './utils/entries';
import { DEFAULT_LOG_RULES, highlightLine, type HighlightedLine } from './utils/highlight';
import { clockTime, toLogLines } from './utils/log-lines';

/** How multi-line entries start: open, folded, or drawn flat with no fold. */
export type LogEntriesStart = 'open' | 'folded' | 'flat';

export interface LogViewProps {
  /**
   * The log: its text, split at each newline, or its lines, each a string or
   * a `LogLine` with a time and an id.
   */
  lines: string | readonly (string | LogLine)[];
  /**
   * Highlights of the app's own, on top of the defaults: where two match the
   * same text, the later one draws it. Keep the array stable (a constant, or
   * memoised): a new one reads every line again.
   */
  rules?: readonly LogRule[];
  /**
   * Whether the defaults apply: times dimmed, failures red, warnings amber,
   * successes green. Turn them off for a log whose app marks its own.
   */
  defaultRules?: boolean;
  /** Wraps a long line onto the next rows. Unset, it is cut short with an ellipsis. */
  wrap?: boolean;
  /**
   * How multi-line entries (a line and the lines indented under it, as a
   * stack trace) start: `open`, or `folded` under their first line; each
   * folds and opens at the chevron beside it. `flat` draws them as plain
   * lines, with no fold.
   */
  entries?: LogEntriesStart;
  /** Names the log to assistive tech. */
  label?: string;
  /** Shown while there are no lines. */
  empty?: ReactNode;
  /** Added to the outer element's classes. */
  className?: string;
}

const NO_RULES: readonly LogRule[] = [];
const NO_ENTRIES: readonly LogEntry[] = [];

// A fold that would hide one line saves nothing and adds a chevron, so an
// entry folds only from two lines under its first.
const FOLDS_FROM = 2;

/** What keeps a line's place: its id, or its index. */
type LineKey = string | number;

// The whole row is washed for an error or a warning line, at the rungs the
// design gives them: red 3 for an error, orange (amber) 2 for a warning.
const WASH: Record<LogLevel, string> = {
  error: 'bg-red-3',
  warning: 'bg-orange-2',
};

// An entry's chevron, count and guide take its first line's tone, as the
// design draws an error's stack trace in red.
const ENTRY_INK: Record<LogLevel | 'none', string> = {
  error: 'text-red-11',
  warning: 'text-orange-11',
  none: 'text-gray-10',
};
const ENTRY_GUIDE: Record<LogLevel | 'none', string> = {
  error: 'bg-red-6',
  warning: 'bg-orange-6',
  none: 'bg-gray-6',
};

/**
 * A log to read, line by line: ANSI colours in the page's tones, times
 * dimmed, failures, warnings and successes highlighted, rules of the app's
 * own on top, and a stack trace folding under its first line.
 *
 * It grows with the page rather than scrolling in a box of its own.
 */
export function LogView({
  lines,
  rules,
  defaultRules = true,
  wrap = false,
  entries: entriesStart = 'open',
  label = 'Log',
  empty = 'Nothing printed yet.',
  className,
}: LogViewProps) {
  const logLines = useMemo(() => toLogLines(lines), [lines]);
  const read = useLineReader(rules ?? NO_RULES, defaultRules);
  const highlighted = useMemo(() => logLines.map((line) => read(line.text)), [logLines, read]);
  const entries = useMemo(() => {
    return entriesStart === 'flat'
      ? NO_ENTRIES
      : groupLogEntries(highlighted.map((line) => line.text)).filter(
          (entry) => entry.end - entry.start - 1 >= FOLDS_FROM,
        );
  }, [entriesStart, highlighted]);

  // The entries the reader turned from how they start, by their first line's
  // key, so a fold holds while lines arrive.
  const [turned, setTurned] = useState<ReadonlySet<LineKey>>(() => new Set());
  const baseId = useId();

  const keyOf = (index: number): LineKey => {
    return logLines[index]?.id ?? index;
  };
  const isOpen = (entry: LogEntry) => {
    return (entriesStart !== 'folded') !== turned.has(keyOf(entry.start));
  };
  const toggle = (entry: LogEntry) => {
    const key = keyOf(entry.start);
    setTurned((was) => {
      const next = new Set(was);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  };

  const blocks = blocksOf(logLines.length, entries);
  // A log with no times has no time column, rather than an empty one. A time
  // shows where it changes from the line shown above it, so a fold moves it.
  const times = logLines.some((line) => line.time !== undefined)
    ? timeColumn(logLines, shownLines(blocks, isOpen))
    : undefined;

  const row = (index: number, gutter?: ReactNode, trailing?: ReactNode) => {
    const line = highlighted[index];
    return line === undefined ? null : (
      <LogRow
        key={keyOf(index)}
        index={index}
        line={line}
        time={times?.get(index)}
        wrap={wrap}
        textId={`${baseId}-${index}`}
        gutter={gutter}
        trailing={trailing}
      />
    );
  };

  const entryBlock = (entry: LogEntry) => {
    const open = isOpen(entry);
    const tone = highlighted[entry.start]?.level ?? 'none';
    const bodyId = `${baseId}-${entry.start}-lines`;
    const countId = `${baseId}-${entry.start}-count`;
    const held = entry.end - entry.start - 1;
    const head = row(
      entry.start,
      <EntryToggle
        open={open}
        onToggle={() => toggle(entry)}
        bodyId={bodyId}
        labelId={`${baseId}-${entry.start}`}
        countId={countId}
        className={ENTRY_INK[tone]}
      />,
      <span id={countId} className={cn('text-11/20 ml-8 shrink-0 select-none', ENTRY_INK[tone])}>
        {held === 1 ? '1 line' : `${held} lines`}
      </span>,
    );
    // The guide runs down from the chevron, beside the lines it folds.
    const guide = (
      <span aria-hidden className="flex w-20 shrink-0 justify-center">
        <span className={cn('w-1', ENTRY_GUIDE[tone])} />
      </span>
    );
    return (
      <div key={keyOf(entry.start)}>
        {head}
        {open ? (
          <div id={bodyId}>
            {range(entry.start + 1, entry.end).map((index) => row(index, guide))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      role="log"
      aria-label={label}
      className={cn(
        'border-gray-5 bg-gray-1 rounded-8 text-12/20 text-gray-12 min-w-0 border-1 py-6 font-mono',
        className,
      )}
    >
      {logLines.length === 0 ? (
        <p className="text-gray-10 px-12 font-sans">{empty}</p>
      ) : (
        blocks.map((block) => {
          return block.entry === undefined ? row(block.index) : entryBlock(block.entry);
        })
      )}
    </div>
  );
}

/** A line on its own, or a multi-line entry. */
interface Block {
  index: number;
  entry?: LogEntry;
}

/** The log as it is drawn: each line on its own, or the entry it starts. */
function blocksOf(count: number, entries: readonly LogEntry[]): Block[] {
  const blocks: Block[] = [];
  let index = 0;
  for (const entry of entries) {
    for (; index < entry.start; index += 1) {
      blocks.push({ index });
    }
    blocks.push({ index: entry.start, entry });
    index = entry.end;
  }
  for (; index < count; index += 1) {
    blocks.push({ index });
  }
  return blocks;
}

/** The indexes of the lines shown, in order: a folded entry shows its first line only. */
function shownLines(blocks: readonly Block[], isOpen: (entry: LogEntry) => boolean): number[] {
  return blocks.flatMap(({ index, entry }) => {
    return entry !== undefined && isOpen(entry) ? range(entry.start, entry.end) : [index];
  });
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, offset) => from + offset);
}

type ShownTime = NonNullable<ReturnType<typeof clockTime>>;

/**
 * The time column, for the lines shown: each one's time, or `null` where it
 * repeats the line above's, so a burst of lines in one second reads as one.
 */
function timeColumn(
  lines: readonly LogLine[],
  shown: readonly number[],
): Map<number, ShownTime | null> {
  const column = new Map<number, ShownTime | null>();
  let last: string | undefined;
  for (const index of shown) {
    const time = clockTime(lines[index]?.time);
    if (time === undefined || time.clock === last) {
      column.set(index, null);
    } else {
      last = time.clock;
      column.set(index, time);
    }
  }
  return column;
}

/**
 * Reads a line's text once per set of rules: a log that grows by a line reads
 * one line, not all of them again.
 */
function useLineReader(rules: readonly LogRule[], defaultRules: boolean) {
  return useMemo(() => {
    const all = defaultRules ? [...DEFAULT_LOG_RULES, ...rules] : rules;
    const cache = new Map<string, HighlightedLine>();
    return (text: string) => {
      let read = cache.get(text);
      if (read === undefined) {
        read = highlightLine(text, all);
        cache.set(text, read);
      }
      return read;
    };
  }, [rules, defaultRules]);
}

interface LogRowProps {
  /** The line's index in the log. */
  index: number;
  line: HighlightedLine;
  /** The time column: unset in a log with no times, `null` where the line repeats the time above. */
  time: ShownTime | null | undefined;
  wrap: boolean;
  /** The id of the line's text, which names an entry's fold. */
  textId: string;
  /** What sits in the gutter: an entry's fold, or the guide beside the lines it holds. */
  gutter?: ReactNode;
  /** After the text: an entry's count. */
  trailing?: ReactNode;
}

function LogRow({ index, line, time, wrap, textId, gutter, trailing }: LogRowProps) {
  return (
    <div
      // The index and the level are said in the markup as well, for an app's
      // own styles and for finding a line, the first error say.
      data-line={index}
      data-level={line.level}
      className={cn('flex min-h-20 pr-12 pl-8', line.level && WASH[line.level])}
    >
      {time !== undefined ? (
        // Out of a selection: a copied run of lines reads as the log printed
        // them, not with a time on every few.
        <span className="text-11/20 text-gray-10 w-56 shrink-0 text-right select-none">
          {time === null ? null : (
            <time dateTime={time.iso} title={time.iso}>
              {time.clock}
            </time>
          )}
        </span>
      ) : null}
      {/* The gutter, where a multi-line entry's fold sits. */}
      {gutter ?? <span aria-hidden className="w-20 shrink-0" />}
      <span
        id={textId}
        className={cn(
          'min-w-0 flex-1',
          wrap ? 'break-all whitespace-pre-wrap' : 'overflow-hidden text-ellipsis whitespace-pre',
        )}
      >
        <LogText spans={line.spans} />
      </span>
      {trailing}
    </div>
  );
}
