import { describe, expect, it } from 'vitest';
import { groupLogEntries, type LogEntry } from './entries';

/** Each entry as its lines, first line first, for reading a failure. */
function grouped(lines: readonly string[]): string[][] {
  return groupLogEntries(lines).map(({ start, end }: LogEntry) => lines.slice(start, end));
}

describe('groupLogEntries', () => {
  it('finds none in a log of lines at one indent', () => {
    expect(groupLogEntries(['one', 'two', 'three'])).toEqual([]);
    expect(groupLogEntries([])).toEqual([]);
  });

  it('groups a line with the lines indented deeper after it', () => {
    const lines = ['before', 'head', '  under', '    deeper', '  under again', 'after'];
    expect(groupLogEntries(lines)).toEqual([{ start: 1, end: 5 }]);
  });

  it('groups a Node stack trace under its error', () => {
    const lines = [
      'error: password authentication failed for user "app_owner"',
      '    at /repo/node_modules/pg-pool/index.js:45:11',
      '    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)',
      'Node.js v24.21.0',
    ];
    expect(grouped(lines)).toEqual([lines.slice(0, 3)]);
  });

  it('keeps a printed object, and its closing brace, with the error that printed it', () => {
    const lines = [
      'error: password authentication failed',
      '    at async migrateDatabase (/repo/src/migrate.ts:23:20)',
      '    at async <anonymous> (/repo/src/cli/migrate.ts:6:1) {',
      "  severity: 'FATAL',",
      "  code: '28P01'",
      '}',
      'Node.js v24.21.0',
    ];
    expect(grouped(lines)).toEqual([lines.slice(0, 6)]);
  });

  it('folds a pretty-printed object under its opening brace', () => {
    expect(grouped(['{', '  "a": 1,', '  "b": [', '    2', '  ]', '}', 'next'])).toEqual([
      ['{', '  "a": 1,', '  "b": [', '    2', '  ]', '}'],
    ]);
  });

  it('leaves a closing bracket alone when nothing in the entry opened one', () => {
    const lines = ['head', '  under', ']'];
    expect(grouped(lines)).toEqual([['head', '  under']]);
  });

  it('counts a stack frame as part of the trace however it is indented', () => {
    const lines = [
      'Exception in thread "main" java.lang.IllegalStateException: no',
      'at com.example.Main.run(Main.java:12)',
      '\tat com.example.Main.main(Main.java:5)',
      'Caused by: java.io.IOException: closed',
      '\t... 3 more',
      'next line',
    ];
    expect(grouped(lines)).toEqual([lines.slice(0, 5)]);
  });

  it('does not take a sentence starting with "at" for a frame', () => {
    expect(groupLogEntries(['retrying', 'at least once more'])).toEqual([]);
  });

  it('counts a tab as deeper than two spaces', () => {
    expect(grouped(['  head', '\tunder'])).toEqual([['  head', '\tunder']]);
  });

  it('keeps blank lines inside an entry, and leaves them out at its end', () => {
    const lines = ['head', '  one', '', '  two', '', 'after'];
    expect(groupLogEntries(lines)).toEqual([{ start: 0, end: 4 }]);
  });

  it('never starts an entry on a blank line', () => {
    expect(groupLogEntries(['', '  indented', 'x'])).toEqual([]);
  });

  it('finds the entries one after another, none inside another', () => {
    const lines = ['a', '  a1', 'b', 'c', '  c1', '    c2', '  c3'];
    expect(groupLogEntries(lines)).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 7 },
    ]);
  });

  it('starts an entry on an indented line, with what is deeper still', () => {
    expect(grouped(['  head', '    under', '  next'])).toEqual([['  head', '    under']]);
  });

  it('groups a Python traceback, leaving its last line, the error, in sight', () => {
    const lines = [
      'Traceback (most recent call last):',
      '  File "job.py", line 3, in <module>',
      '    1 / 0',
      'ZeroDivisionError: division by zero',
    ];
    expect(grouped(lines)).toEqual([lines.slice(0, 3)]);
  });
});
