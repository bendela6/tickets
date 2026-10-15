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

/** How a section starts: how deep it sits, and whether it starts open. */
export interface LogSection {
  /**
   * How deep it sits: 0, the top, unless given. A section runs until the
   * next one at its level or above it; one at a deeper level starts inside it.
   */
  level?: number;
  /**
   * Whether it starts open or folded. Unset, it is open while it holds the
   * log's last line or a failure, and folded otherwise: a streaming log's
   * running step is open, and folds once it is through. Once the reader
   * opens or folds it, it stays as they left it.
   */
  start?: 'open' | 'folded';
}

/** Starts a section at each line it matches. */
export interface LogSectionRule extends LogSection {
  /**
   * The lines that start one, read as plain text. A string matches a line
   * that holds it, case and all; a regular expression, a line it matches
   * (`^` ties it to the line's start).
   */
  match: string | RegExp;
}

/**
 * Says whether a line starts a section, and how: its level and how it
 * starts, or nothing for a line that belongs to the section it is in. Given
 * the line's plain text, its escape codes taken out, and its index.
 */
export type LogSectionOf = (text: string, index: number) => LogSection | undefined;

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
