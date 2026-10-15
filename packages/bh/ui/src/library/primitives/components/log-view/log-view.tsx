// A log to read: any app's, line by line, in the page's monospace. Each line is
// read once (./utils/highlight): its ANSI colours drawn in the page's tones, its
// escape codes dropped, then the highlight rules run over its plain text. The
// rules are data, the defaults first and the app's own on top, so the view
// knows nothing of what the app logs.
//
// The lines are drawn as a tree (./utils/sections): the sections the app says
// start at some lines, nested by level, and in each the multi-line entries, a
// line and what is indented under it as a stack trace is (./utils/entries).
// Every fold is @bh/hooks' useDisclosure, held here by its first line, so a
// fold keeps its state while lines arrive and while a section around it is
// folded. The log grows with the page, which follows its end while lines
// arrive (./use-follow-end), and a screen reader hears a section start,
// finish or fail (./use-section-news), never each line.

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../../../style';
import { JumpToEnd } from './parts/jump-to-end';
import { LogNodes } from './parts/log-nodes';
import type { RowTime } from './parts/log-row';
import type { LineKey, LogViewModel } from './parts/view';
import type { LogLine, LogRule, LogSectionOf, LogSectionRule } from './types';
import { useFollowEnd } from './use-follow-end';
import { useSectionNews, type SectionReport } from './use-section-news';
import { DEFAULT_LOG_RULES, highlightLine, type HighlightedLine } from './utils/highlight';
import { clockTime, formatTook, toLogLines } from './utils/log-lines';
import {
  buildLogTree,
  foldHead,
  sectionReader,
  sectionSpan,
  sectionState,
  sectionsOf,
  shownLines,
  type LogFold,
  type LogNode,
} from './utils/sections';

/** How multi-line entries start: open, folded, or drawn flat with no fold. */
export type LogEntriesStart = 'open' | 'folded' | 'flat';

export interface LogViewProps {
  /**
   * The log: its text, split at each newline, or its lines, each a string or
   * a `LogLine` with a time and an id.
   */
  lines: string | readonly (string | LogLine)[];
  /**
   * Which lines start a section, and at which level: rules, the first to
   * match a line saying how its section starts, or a function given each
   * line. Unset, the log has no sections. Keep it stable (a constant, or
   * memoised): a new one reads every line again.
   */
  sections?: readonly LogSectionRule[] | LogSectionOf;
  /**
   * Whether lines are still arriving. While they are, the section holding
   * the last line is running, its time ticking; it finishes, or fails, when
   * the next one starts or this turns off.
   */
  streaming?: boolean;
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

/**
 * A log to read, line by line: ANSI colours in the page's tones, times
 * dimmed, failures, warnings and successes highlighted, rules of the app's
 * own on top, sections that fold, nested at the levels the app gives, and a
 * stack trace folding under its first line.
 *
 * It grows with the page rather than scrolling in a box of its own, and
 * keeps the page at its end while lines arrive, until the reader scrolls up.
 */
export function LogView({
  lines,
  sections,
  streaming = false,
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
  const sectionAt = useMemo(() => sectionReader(sections), [sections]);
  const tree = useMemo(
    () => buildLogTree(highlighted, sectionAt, entriesStart !== 'flat'),
    [highlighted, sectionAt, entriesStart],
  );
  const count = logLines.length;

  const keyOf = useCallback((index: number): LineKey => logLines[index]?.id ?? index, [logLines]);

  // The folds the reader opened or folded, by their first line's key; the
  // rest are as they start.
  const [chosen, setChosen] = useState<ReadonlyMap<LineKey, boolean>>(() => new Map());
  const startsOpen = (fold: LogFold): boolean => {
    if (fold.kind === 'entry') {
      return entriesStart !== 'folded';
    }
    if (fold.start !== undefined) {
      return fold.start === 'open';
    }
    // The step at the end, and any that failed: a streaming log keeps the
    // one running open, and folds it once it is through.
    return fold.end === count || fold.failed;
  };
  const isOpen = (fold: LogFold): boolean => {
    return chosen.get(keyOf(foldHead(fold))) ?? startsOpen(fold);
  };
  const setOpen = (fold: LogFold, open: boolean) => {
    const key = keyOf(foldHead(fold));
    setChosen((was) => new Map(was).set(key, open));
  };

  // A log with no times has no time column, rather than an empty one. A time
  // shows where it changes from the line shown above it, so a fold moves it.
  const times = logLines.some((line) => line.time !== undefined)
    ? timeColumn(logLines, shownLines(tree, isOpen))
    : undefined;

  const baseId = useId();
  const view: LogViewModel = {
    lines: logLines,
    highlighted,
    timeOf: (index): RowTime => (times === undefined ? undefined : (times.get(index) ?? null)),
    wrap,
    streaming,
    textId: (index) => `${baseId}-${index}`,
    keyOf,
    isOpen,
    setOpen,
  };

  const logRef = useRef<HTMLDivElement>(null);
  const indexOf = useCallback(
    (key: LineKey) => {
      if (typeof key === 'number' && keyOf(key) === key) {
        return key;
      }
      for (let index = logLines.length - 1; index >= 0; index -= 1) {
        if (keyOf(index) === key) {
          return index;
        }
      }
      return -1;
    },
    [logLines, keyOf],
  );
  const { unseen, jump } = useFollowEnd(logRef, {
    count,
    lastKey: count > 0 ? keyOf(count - 1) : undefined,
    indexOf,
  });

  const reports = useMemo(
    () => sectionReports(tree, logLines, highlighted, streaming, keyOf),
    [tree, logLines, highlighted, streaming, keyOf],
  );
  const news = useSectionNews(reports);

  return (
    <div
      ref={logRef}
      // A log, but not one read out line by line as it grows: what a screen
      // reader hears while it streams is the status below.
      role="log"
      aria-live="off"
      aria-label={label}
      className={cn(
        'border-gray-5 bg-gray-1 rounded-8 text-12/20 text-gray-12 min-w-0 border-1 py-6 font-mono',
        className,
      )}
    >
      {count === 0 ? (
        <p className="text-gray-10 px-12 font-sans">{empty}</p>
      ) : (
        <LogNodes nodes={tree} depth={0} view={view} />
      )}
      {unseen > 0 ? <JumpToEnd unseen={unseen} onJump={jump} logRef={logRef} /> : null}
      <div role="status" className="sr-only">
        {news}
      </div>
    </div>
  );
}

/**
 * The time column, for the lines shown: each one's time in full, or `null`
 * where it repeats the line above's on the clock, so a burst of lines in one
 * second reads as one.
 */
function timeColumn(
  lines: readonly LogLine[],
  shown: readonly number[],
): Map<number, string | null> {
  const column = new Map<number, string | null>();
  let last: string | undefined;
  for (const index of shown) {
    const time = clockTime(lines[index]?.time);
    if (time === undefined || time.clock === last) {
      column.set(index, null);
    } else {
      last = time.clock;
      column.set(index, time.iso);
    }
  }
  return column;
}

/** Each section as the screen reader's news reads it. */
function sectionReports(
  tree: readonly LogNode[],
  lines: readonly LogLine[],
  highlighted: readonly HighlightedLine[],
  streaming: boolean,
  keyOf: (index: number) => LineKey,
): SectionReport[] {
  return sectionsOf(tree).map(({ section, parent }) => {
    const state = sectionState(section, lines.length, streaming);
    const running = streaming && section.end === lines.length;
    const { from, to } = sectionSpan(section, lines, running);
    return {
      key: keyOf(section.head),
      title: highlighted[section.head]?.text.trim() ?? '',
      state,
      ...(from !== undefined && to !== undefined ? { took: formatTook(to - from) } : {}),
      ...(parent === undefined ? {} : { parent: keyOf(parent.head) }),
    };
  });
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
