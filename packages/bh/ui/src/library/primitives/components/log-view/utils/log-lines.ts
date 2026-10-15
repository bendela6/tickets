import type { LogLine } from '../types';
import { stripAnsi } from './ansi';

/**
 * The log as lines: text split at each newline (`\n` or `\r\n`), or the
 * app's own lines, a string each or a `LogLine`.
 *
 * A carriage return inside a line is a terminal's way of printing over it, as
 * a progress bar does, so a line keeps only what was printed last: the text
 * after its last carriage return that shows anything (an erase code alone,
 * as in `\r\x1b[K`, does not).
 */
export function toLogLines(lines: string | readonly (string | LogLine)[]): LogLine[] {
  const list = typeof lines === 'string' ? splitText(lines) : lines;
  return list.map((line) => {
    if (typeof line === 'string') {
      return { text: overprinted(line) };
    }
    return line.text.includes('\r') ? { ...line, text: overprinted(line.text) } : line;
  });
}

function splitText(text: string): string[] {
  if (text === '') {
    return [];
  }
  const lines = text.split(/\r?\n/);
  // A log that ends with a newline has no empty line after it.
  if (lines.at(-1) === '') {
    lines.pop();
  }
  return lines;
}

function overprinted(line: string): string {
  if (!line.includes('\r')) {
    return line;
  }
  const passes = line.split('\r');
  for (let index = passes.length - 1; index >= 0; index -= 1) {
    const pass = passes[index] ?? '';
    if (stripAnsi(pass).trim() !== '') {
      return pass;
    }
  }
  return '';
}

/** A line's time as the clock reads it, `14:02:07`, and in full, for its title; none if it does not parse. */
export function clockTime(time: LogLine['time']): { clock: string; iso: string } | undefined {
  if (time === undefined) {
    return undefined;
  }
  const date = time instanceof Date ? time : new Date(time);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const two = (value: number) => {
    return String(value).padStart(2, '0');
  };
  return {
    clock: `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`,
    iso: date.toISOString(),
  };
}

/** A line's time in milliseconds since the epoch; none if it has none, or it does not parse. */
export function timeOf(time: LogLine['time']): number | undefined {
  if (time === undefined) {
    return undefined;
  }
  const ms = time instanceof Date ? time.getTime() : new Date(time).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * How long something took, as a section shows it: tenths of a second under
 * ten seconds when the times have them (`4.9 s`), whole seconds to a minute
 * (`31 s`), then minutes and seconds (`2 min 5 s`), then hours and minutes.
 * `whole` drops the tenths, for a time still ticking.
 */
export function formatTook(ms: number, { whole = false }: { whole?: boolean } = {}): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const seconds = Math.floor(tenths / 10);
  if (seconds < 10 && !whole && tenths % 10 !== 0) {
    return `${(tenths / 10).toFixed(1)} s`;
  }
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const rest = seconds % 60;
    return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
