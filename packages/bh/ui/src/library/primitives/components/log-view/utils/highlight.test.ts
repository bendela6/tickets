import { describe, expect, it } from 'vitest';
import type { LogRule, LogTone } from '../types';
import { DEFAULT_LOG_RULES, highlightLine } from './highlight';
import { toLogLines } from './log-lines';

/** What a rule marked in a line: each marked run's text and its tone. */
function marked(text: string, rules: readonly LogRule[] = DEFAULT_LOG_RULES): [string, LogTone][] {
  return highlightLine(text, rules)
    .spans.filter((span) => span.tone !== undefined)
    .map((span) => [span.text, span.tone as LogTone]);
}

const levelOf = (text: string, rules: readonly LogRule[] = DEFAULT_LOG_RULES) => {
  return highlightLine(text, rules).level;
};

describe('the default rules', () => {
  it('dim times, in full or on the clock', () => {
    expect(marked('time="2026-10-08T00:42:09Z" msg=x')).toEqual([
      ['2026-10-08T00:42:09Z', 'quiet'],
    ]);
    expect(marked('[2026-10-08 21:39:00.021] started')).toEqual([
      ['2026-10-08 21:39:00.021', 'quiet'],
    ]);
    expect(marked('00:46:13 building')).toEqual([['00:46:13', 'quiet']]);
  });

  it('leave a file position alone, which only looks like a time', () => {
    expect(marked('at x (/repo/src/migrate.ts:23:20)')).toEqual([['at', 'quiet']]);
    expect(marked('node:internal/process/task_queues:104:5')).toEqual([]);
  });

  it('mark failures red and make the line an error line', () => {
    for (const word of [
      'error:',
      '[ERROR]',
      'FAIL',
      'failed',
      'Failed',
      '[FATAL]',
      'level=error',
    ]) {
      expect(marked(`x ${word} y`), word).toEqual([[word, 'danger']]);
      expect(levelOf(`x ${word} y`), word).toBe('error');
    }
    expect(marked('TypeError: boom')).toEqual([['TypeError:', 'danger']]);
    expect(marked('java.lang.IllegalStateException: no')).toEqual([
      ['IllegalStateException:', 'danger'],
    ]);
  });

  it('leave words that only contain a failure alone', () => {
    expect(marked('    Error.captureStackTrace(err)')).toEqual([]);
    expect(marked('0 errors, 2 warnings')).toEqual([]);
    expect(levelOf('Compiled with 0 errors')).toBeUndefined();
    // A field's value, as a printed error object has it.
    expect(levelOf("  severity: 'FATAL',")).toBeUndefined();
  });

  it('mark warnings amber and make the line a warning line', () => {
    for (const word of [
      'warn',
      'warning:',
      '[WARN]',
      'WARNING',
      'level=warning',
      'Warning:',
      '(!)',
    ]) {
      expect(marked(`x ${word} y`), word).toEqual([[word, 'warning']]);
      expect(levelOf(`x ${word} y`), word).toBe('warning');
    }
  });

  it('mark successes green, without a level', () => {
    for (const word of ['OK', 'DONE', 'Done', 'healthy', 'Healthy', 'PASS', '✓']) {
      expect(marked(`x ${word} y`), word).toEqual([[word, 'success']]);
      expect(levelOf(`x ${word} y`), word).toBeUndefined();
    }
    // A build's progress says `done` in lower case on every line.
    expect(marked('transferring dockerfile: 3.12kB done')).toEqual([]);
  });

  it('dim the `at` of a stack frame', () => {
    expect(marked('    at async migrateDatabase (migrate.ts:23:20)')).toEqual([
      ['at async', 'quiet'],
    ]);
  });

  it('rank an error over a warning on the same line', () => {
    expect(levelOf('[WARN] retry failed')).toBe('error');
    expect(levelOf('error: x, warning: y')).toBe('error');
  });
});

describe('the app’s own rules', () => {
  const rules: LogRule[] = [...DEFAULT_LOG_RULES, { match: 'CACHED', tone: 'quiet' }];

  it('add to the defaults', () => {
    expect(marked('#7 CACHED done OK', rules)).toEqual([
      ['CACHED', 'quiet'],
      ['OK', 'success'],
    ]);
  });

  it('draw over a default where they match the same text', () => {
    const over: LogRule[] = [...DEFAULT_LOG_RULES, { match: /\bFAIL\b/, tone: 'purple' }];
    expect(marked('FAIL src/x.test.ts', over)).toEqual([['FAIL', 'purple']]);
    // The line is still an error line: the default matched it.
    expect(levelOf('FAIL src/x.test.ts', over)).toBe('error');
  });

  it('match a string as itself, never as a pattern', () => {
    expect(marked('a.b axb', [{ match: 'a.b', tone: 'blue' }])).toEqual([['a.b', 'blue']]);
  });

  it('mark every match of a pattern, whatever its own flags', () => {
    const sticky: LogRule = { match: /id=\d+/y, tone: 'quiet' };
    expect(marked('id=1 and id=2', [sticky])).toEqual([
      ['id=1', 'quiet'],
      ['id=2', 'quiet'],
    ]);
    const caseless: LogRule = { match: /retry/i, tone: 'orange', level: 'warning' };
    expect(marked('Retry, retry', [caseless])).toEqual([
      ['Retry', 'orange'],
      ['retry', 'orange'],
    ]);
  });

  it('survive a pattern that can match nothing', () => {
    expect(marked('abc', [{ match: /x*/, tone: 'red' }])).toEqual([]);
  });

  it('run on the text with its escape codes taken out', () => {
    const line = '\u001b[1m\u001b[31merr\u001b[0mor: no';
    expect(marked(line)).toEqual([
      ['err', 'danger'],
      ['or:', 'danger'],
    ]);
    const spans = highlightLine(line, DEFAULT_LOG_RULES).spans;
    // The printed bold stays under the rule's tone.
    expect(spans[0]?.style.bold).toBe(true);
    expect(highlightLine(line, DEFAULT_LOG_RULES).text).toBe('error: no');
  });
});

describe('toLogLines', () => {
  it('splits text at each newline, with no empty line after the last', () => {
    expect(toLogLines('a\nb\r\nc\n').map((line) => line.text)).toEqual(['a', 'b', 'c']);
    expect(toLogLines('')).toEqual([]);
  });

  it('keeps what a carriage return printed over last', () => {
    expect(toLogLines(['10%\r50%\r100%']).map((line) => line.text)).toEqual(['100%']);
    expect(toLogLines(['building\r\u001b[K']).map((line) => line.text)).toEqual(['building']);
  });

  it('takes the app’s lines as they are', () => {
    const line = { text: 'x', time: 0, id: 'a' };
    expect(toLogLines([line, 'y'])).toEqual([line, { text: 'y' }]);
  });
});
