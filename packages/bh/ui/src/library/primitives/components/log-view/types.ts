import type { Tone } from '../../../../style';

/** One line of a log, as the app has it. */
export interface LogLine {
  /** What was printed, escape codes and all: ANSI colours are drawn, the other codes dropped. */
  text: string;
  /**
   * When it was printed: a `Date`, epoch milliseconds or an ISO string. Shown
   * as the clock reads it (`14:02:07`) beside the line, only when it changes
   * from the line above.
   */
  time?: Date | number | string;
  /**
   * What keeps the line's place, such as a fold, while the start of the log
   * moves on (a tail of the last 500 lines). Unset, the line's index does,
   * which holds while lines are only added at the end.
   */
  id?: string | number;
}

/**
 * How a rule draws the text it matches: a tone, its rung 11 in bold, or
 * `quiet`, the dim gray of what a reader skims past (times, ids, `at`).
 */
export type LogTone = Tone | 'quiet';

/** What a line counts as when a rule marks it: an error or a warning line is washed in its tone. */
export type LogLevel = 'error' | 'warning';

/** A highlight: the text it matches, and how that text is drawn. */
export interface LogRule {
  /**
   * What it marks. A string matches itself, case and all, wherever it
   * appears; a regular expression marks each of its matches.
   */
  match: string | RegExp;
  /** How the matched text is drawn. */
  tone: LogTone;
  /** Makes every line it matches an error or a warning line: the whole line washed in its tone. */
  level?: LogLevel;
}
