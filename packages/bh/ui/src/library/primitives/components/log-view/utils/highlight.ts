import type { LogLevel, LogRule, LogTone } from '../types';
import { parseAnsi, type AnsiStyle } from './ansi';

/**
 * What every log is highlighted with unless the app turns it off: times and
 * stack frames' `at` dimmed, failures red, warnings amber, successes green.
 * A line with a failure is an error line and one with a warning a warning
 * line, washed in that tone.
 *
 * The words are matched as written, so `Error.captureStackTrace` and a
 * lower-case `done` (as in `3.12kB done`) stay plain: a capitalised `Error`
 * or `Warning` counts only before a colon, as a thrown error prints it. A
 * bare `FATAL` stays plain too, being a field's value as often as a verdict
 * (`severity: 'FATAL'`); in brackets, `[FATAL]`, it is a failure.
 */
export const DEFAULT_LOG_RULES: readonly LogRule[] = [
  {
    // 2026-10-08T00:42:09.021Z, 2026-10-08 00:42:09 and a bare 00:42:09.
    match:
      /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?|\b\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?\b/,
    tone: 'quiet',
  },
  // A stack frame's `at`, which every frame repeats.
  { match: /(?<=^\s*)at(?: async)?(?= )/, tone: 'quiet' },
  { match: /✓|✔|\b(?:OK|DONE|Done|PASS|healthy|Healthy)\b/, tone: 'success' },
  {
    match: /\[(?:WARN|WARNING)\]|\b(?:level=)?(?:warn|warning|WARN|WARNING)\b:?|\bWarning:|\(!\)/,
    tone: 'warning',
    level: 'warning',
  },
  {
    match:
      /\[(?:ERROR|ERR|FATAL)\]|\b(?:level=)?(?:error|ERROR|failed|Failed|FAILED|FAIL)\b:?|\b(?:[A-Z][A-Za-z]*)?(?:Error|Exception):/,
    tone: 'danger',
    level: 'error',
  },
];

/** A run of a highlighted line: printed one way, and marked by one rule or none. */
export interface LogSpan {
  text: string;
  /** How the program printed it. */
  style: AnsiStyle;
  /** How the last rule to match it draws it, over the printed colour. */
  tone?: LogTone;
}

/** A line read for drawing. */
export interface HighlightedLine {
  /** Its text with the escape codes taken out: what a reader copies, and what is searched. */
  text: string;
  spans: LogSpan[];
  /** Set when a rule with a level matched: an error outranks a warning, whichever rule came last. */
  level?: LogLevel;
}

const LEVEL_RANK: Record<LogLevel, number> = { warning: 1, error: 2 };

/**
 * Reads one raw line: its ANSI colours, then the rules over its plain text.
 *
 * The rules apply in order, so where two match the same text the later one
 * draws it: the defaults first, the app's own after them. A rule's tone takes
 * the place of the printed colour on what it matches; the printed background,
 * weight and underline stay.
 */
export function highlightLine(raw: string, rules: readonly LogRule[]): HighlightedLine {
  const segments = parseAnsi(raw);
  const text = segments.map((segment) => segment.text).join('');
  const tones: (LogTone | undefined)[] = new Array<LogTone | undefined>(text.length);
  let level: LogLevel | undefined;

  for (const rule of rules) {
    let matched = false;
    for (const [start, end] of matches(text, rule.match)) {
      matched = true;
      tones.fill(rule.tone, start, end);
    }
    if (
      matched &&
      rule.level !== undefined &&
      (level === undefined || LEVEL_RANK[rule.level] > LEVEL_RANK[level])
    ) {
      level = rule.level;
    }
  }

  const spans: LogSpan[] = [];
  let offset = 0;
  for (const segment of segments) {
    let start = 0;
    while (start < segment.text.length) {
      const tone = tones[offset + start];
      let end = start + 1;
      while (end < segment.text.length && tones[offset + end] === tone) {
        end += 1;
      }
      spans.push({
        text: segment.text.slice(start, end),
        style: segment.style,
        ...(tone === undefined ? {} : { tone }),
      });
      start = end;
    }
    offset += segment.text.length;
  }
  return level === undefined ? { text, spans } : { text, spans, level };
}

// Each rule's pattern made global once, rather than on every line.
const GLOBAL = new WeakMap<RegExp, RegExp>();

function globalPattern(match: string | RegExp): RegExp {
  if (typeof match === 'string') {
    return new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  }
  let pattern = GLOBAL.get(match);
  if (pattern === undefined) {
    // Sticky would anchor every match at the last one's end; global walks the line.
    pattern = new RegExp(match.source, `${match.flags.replace(/[gy]/g, '')}g`);
    GLOBAL.set(match, pattern);
  }
  return pattern;
}

/** Each non-empty match of a pattern in the text, as [start, end). */
function matches(text: string, match: string | RegExp): [number, number][] {
  if (match === '' || text === '') {
    return [];
  }
  const pattern = globalPattern(match);
  pattern.lastIndex = 0;
  const found: [number, number][] = [];
  for (let result = pattern.exec(text); result !== null; result = pattern.exec(text)) {
    if (result[0] === '') {
      // An empty match would find itself forever; step past it.
      pattern.lastIndex += 1;
      continue;
    }
    found.push([result.index, result.index + result[0].length]);
  }
  return found;
}
