import type { LogLine } from '../types';
import type { HighlightedLine } from '../utils/highlight';
import type { LogFold } from '../utils/sections';
import type { RowTime } from './log-row';

/** What keeps a line's place: its id, or its index. */
export type LineKey = string | number;

/** What every part of a drawn log reads: the lines, how they are drawn, and which folds are open. */
export interface LogViewModel {
  lines: readonly LogLine[];
  highlighted: readonly HighlightedLine[];
  /** The time column, by line index; unset in a log with no times. */
  timeOf: (index: number) => RowTime;
  wrap: boolean;
  /** Whether lines are still arriving. */
  streaming: boolean;
  /** The id a line's text is drawn under. */
  textId: (index: number) => string;
  keyOf: (index: number) => LineKey;
  isOpen: (fold: LogFold) => boolean;
  setOpen: (fold: LogFold, open: boolean) => void;
}
