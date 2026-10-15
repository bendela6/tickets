import type { LogLevel, LogLine, LogSection, LogSectionOf, LogSectionRule } from '../types';
import { groupLogEntries } from './entries';
import { timeOf } from './log-lines';

/** A line on its own. */
export interface LogLineNode {
  kind: 'line';
  index: number;
}

/**
 * A multi-line entry: a line and the lines after it that belong to it, as a
 * stack trace belongs to its error, from `start` to one before `end`.
 */
export interface LogEntryNode {
  kind: 'entry';
  start: number;
  end: number;
}

/**
 * A section: the line that starts it (`head`) and everything up to one
 * before `end`, its own lines and the sections nested in it.
 */
export interface LogSectionNode {
  kind: 'section';
  head: number;
  end: number;
  /** The level the app gave it. */
  level: number;
  /** How it starts, when the app said. */
  start?: LogSection['start'];
  /** Whether a line in it, its first included, is an error line. */
  failed: boolean;
  /** What it holds after its first line, in order. */
  children: LogNode[];
}

/** One part of the log as it is drawn. */
export type LogNode = LogLineNode | LogEntryNode | LogSectionNode;

/** What the tree reads of each line: its plain text and its level. */
interface ReadLine {
  text: string;
  level?: LogLevel;
}

// A fold that would hide one line saves nothing and adds a chevron, so an
// entry folds only from two lines under its first.
const FOLDS_FROM = 2;

// Each rule's pattern without `g` or `y`, which would carry a `lastIndex`
// from one line to the next.
const PLAIN = new WeakMap<RegExp, RegExp>();

function matchesLine(text: string, match: string | RegExp): boolean {
  if (typeof match === 'string') {
    return match !== '' && text.includes(match);
  }
  let pattern = PLAIN.get(match);
  if (pattern === undefined) {
    pattern = new RegExp(match.source, match.flags.replace(/[gy]/g, ''));
    PLAIN.set(match, pattern);
  }
  return pattern.test(text);
}

/** The app's rules or function, as one function: the first rule to match a line says how its section starts. */
export function sectionReader(
  sections: readonly LogSectionRule[] | LogSectionOf | undefined,
): LogSectionOf | undefined {
  if (sections === undefined || typeof sections === 'function') {
    return sections;
  }
  if (sections.length === 0) {
    return undefined;
  }
  return (text) => {
    return sections.find((rule) => matchesLine(text, rule.match));
  };
}

interface Frame {
  section?: LogSectionNode;
  children: LogNode[];
  /** Its own lines read so far and not yet placed, waiting to be grouped into entries. */
  run: number[];
}

/**
 * The log as it is drawn: its sections, nested by level, and in each the
 * lines and multi-line entries before the sections it holds.
 *
 * A section starts at a line `sectionAt` gives a level and runs until the
 * next line it gives a level at or above it; one given a deeper level starts
 * inside it. Without `sectionAt`, the log is lines and entries alone. Entries
 * are grouped within each section's own lines, and only when `entries` is
 * set.
 */
export function buildLogTree(
  lines: readonly ReadLine[],
  sectionAt: LogSectionOf | undefined,
  entries: boolean,
): LogNode[] {
  const errorsBefore = errorCounts(lines);
  const root: Frame = { children: [], run: [] };
  const stack: Frame[] = [root];

  const place = (frame: Frame) => {
    if (frame.run.length > 0) {
      frame.children.push(...groupRun(frame.run, lines, entries));
      frame.run = [];
    }
  };
  const close = (frame: Frame, end: number) => {
    place(frame);
    const section = frame.section;
    if (section !== undefined) {
      section.end = end;
      section.failed = (errorsBefore[end] ?? 0) - (errorsBefore[section.head] ?? 0) > 0;
    }
  };

  lines.forEach((line, index) => {
    const starts = sectionAt?.(line.text, index);
    let top = stack[stack.length - 1] ?? root;
    if (starts === undefined) {
      top.run.push(index);
      return;
    }
    const level = starts.level ?? 0;
    while (top.section !== undefined && top.section.level >= level) {
      close(top, index);
      stack.pop();
      top = stack[stack.length - 1] ?? root;
    }
    place(top);
    const section: LogSectionNode = {
      kind: 'section',
      head: index,
      end: lines.length,
      level,
      ...(starts.start === undefined ? {} : { start: starts.start }),
      failed: false,
      children: [],
    };
    top.children.push(section);
    stack.push({ section, children: section.children, run: [] });
  });
  for (let depth = stack.length - 1; depth >= 0; depth -= 1) {
    const frame = stack[depth];
    if (frame !== undefined) {
      close(frame, lines.length);
    }
  }
  return root.children;
}

/** How many error lines come before each index: `[i]` counts those before line `i`. */
function errorCounts(lines: readonly ReadLine[]): number[] {
  const counts = [0];
  lines.forEach((line, index) => {
    counts.push((counts[index] ?? 0) + (line.level === 'error' ? 1 : 0));
  });
  return counts;
}

/** A run of a section's own lines, each a line on its own or in the entry it starts. */
function groupRun(run: readonly number[], lines: readonly ReadLine[], entries: boolean): LogNode[] {
  const from = run[0] ?? 0;
  const found = entries
    ? groupLogEntries(run.map((index) => lines[index]?.text ?? '')).filter(
        (entry) => entry.end - entry.start - 1 >= FOLDS_FROM,
      )
    : [];
  const nodes: LogNode[] = [];
  let at = 0;
  for (const entry of found) {
    for (; at < entry.start; at += 1) {
      nodes.push({ kind: 'line', index: from + at });
    }
    nodes.push({ kind: 'entry', start: from + entry.start, end: from + entry.end });
    at = entry.end;
  }
  for (; at < run.length; at += 1) {
    nodes.push({ kind: 'line', index: from + at });
  }
  return nodes;
}

/** A fold: a section with lines under its first, or a multi-line entry. */
export type LogFold = LogEntryNode | LogSectionNode;

/** The index of a fold's first line, which keeps its place. */
export function foldHead(fold: LogFold): number {
  return fold.kind === 'section' ? fold.head : fold.start;
}

/** The indexes of the lines shown, in order: a folded section or entry shows its first line only. */
export function shownLines(
  nodes: readonly LogNode[],
  isOpen: (fold: LogFold) => boolean,
): number[] {
  const shown: number[] = [];
  const walk = (list: readonly LogNode[]) => {
    for (const node of list) {
      if (node.kind === 'line') {
        shown.push(node.index);
      } else if (node.kind === 'entry') {
        const last = isOpen(node) ? node.end : node.start + 1;
        for (let index = node.start; index < last; index += 1) {
          shown.push(index);
        }
      } else {
        shown.push(node.head);
        if (isOpen(node)) {
          walk(node.children);
        }
      }
    }
  };
  walk(nodes);
  return shown;
}

/** Every section in the tree, each before those inside it, with the section it is in. */
export function sectionsOf(
  nodes: readonly LogNode[],
): { section: LogSectionNode; parent?: LogSectionNode }[] {
  const found: { section: LogSectionNode; parent?: LogSectionNode }[] = [];
  const walk = (list: readonly LogNode[], parent?: LogSectionNode) => {
    for (const node of list) {
      if (node.kind === 'section') {
        found.push(parent === undefined ? { section: node } : { section: node, parent });
        walk(node.children, node);
      }
    }
  };
  walk(nodes);
  return found;
}

/** How a section is doing: still taking lines, through, or holding a failure. */
export type LogSectionState = 'running' | 'done' | 'failed';

/**
 * A section's state: failed once it holds an error line, running while the
 * log streams and it holds the last line, and done otherwise.
 */
export function sectionState(
  section: LogSectionNode,
  count: number,
  streaming: boolean,
): LogSectionState {
  if (section.failed) {
    return 'failed';
  }
  return streaming && section.end === count ? 'running' : 'done';
}

/**
 * When a section started and ended, in milliseconds: from its first line's
 * time to the time of the line after it, or, at the log's end, of its own
 * last line with one. `to` is unset while it still runs, its end not yet
 * known; both are unset for lines with no times.
 */
export function sectionSpan(
  section: LogSectionNode,
  lines: readonly LogLine[],
  running: boolean,
): { from?: number; to?: number } {
  const from = timeOf(lines[section.head]?.time);
  if (from === undefined || running) {
    return from === undefined ? {} : { from };
  }
  let to = section.end < lines.length ? timeOf(lines[section.end]?.time) : undefined;
  for (let index = section.end - 1; to === undefined && index > section.head; index -= 1) {
    to = timeOf(lines[index]?.time);
  }
  return { from, to: to ?? from };
}
