import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LogView } from './log-view';
import type { LogLine } from './types';
import { clockTime } from './utils/log-lines';

const ESC = '\u001b';

/** The rows of the log shown, in order. */
function rows(): HTMLElement[] {
  return Array.from(screen.getByRole('log').querySelectorAll<HTMLElement>('[data-line]'));
}

/** The text of the rows shown. */
function shown(): string[] {
  return rows().map((row) => row.querySelector('[id]')?.textContent ?? '');
}

/** The element a run of text is drawn in. */
function drawn(text: string): HTMLElement {
  return screen.getByText(text, { exact: true, selector: 'span' });
}

describe('LogView', () => {
  it('draws a line per line of text, under its name', () => {
    render(<LogView lines={'first\nsecond\nthird\n'} label="Deploy 14" />);
    expect(screen.getByRole('log', { name: 'Deploy 14' })).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toEqual(['first', 'second', 'third']);
  });

  it('says so while there are no lines', () => {
    render(<LogView lines={[]} empty="Nothing yet" />);
    expect(screen.getByRole('log')).toHaveTextContent('Nothing yet');
  });

  it('never shows an escape code, and draws ANSI colours in the page’s hues', () => {
    render(
      <LogView lines={[`${ESC}[32mgreen${ESC}[0m and ${ESC}[1;35mmagenta${ESC}[0m${ESC}[2K`]} />,
    );
    const log = screen.getByRole('log');
    expect(log.textContent).toBe('green and magenta');
    expect(log.textContent).not.toContain(ESC);
    expect(drawn('green').className).toMatch(/\btext-green-\d+\b/);
    // Magenta is Instrument's purple; bold is kept.
    expect(drawn('magenta').className).toMatch(/\btext-purple-\d+\b/);
    expect(drawn('magenta').className).toMatch(/\bfont-600\b/);
  });

  it('marks an error line and an error word, by default', () => {
    render(<LogView lines={['all good', 'error: password authentication failed']} />);
    const [good, bad] = rows();
    expect(good).not.toHaveAttribute('data-level');
    expect(bad).toHaveAttribute('data-level', 'error');
    expect(drawn('error:').className).toMatch(/\btext-red-\d+\b/);
  });

  it('marks a warning line, and leaves a success unwashed', () => {
    render(<LogView lines={['[WARN] slow download', 'Done in 9.6s']} />);
    const [warning, success] = rows();
    expect(warning).toHaveAttribute('data-level', 'warning');
    expect(success).not.toHaveAttribute('data-level');
    expect(drawn('Done').className).toMatch(/\btext-green-\d+\b/);
  });

  it('draws the app’s rules on top of the defaults', () => {
    render(<LogView lines={['#7 CACHED']} rules={[{ match: 'CACHED', tone: 'blue' }]} />);
    expect(drawn('CACHED').className).toMatch(/\btext-blue-\d+\b/);
  });

  it('leaves the defaults off when asked', () => {
    render(<LogView lines={['error: x']} defaultRules={false} />);
    expect(rows()[0]).not.toHaveAttribute('data-level');
    expect(screen.getByRole('log')).toHaveTextContent('error: x');
  });

  it('shows a line’s time only where it changes from the line above', () => {
    const at = new Date(2026, 9, 8, 21, 39, 0).getTime();
    const lines: LogLine[] = [
      { text: 'one', time: at },
      { text: 'two', time: at + 200 },
      { text: 'three', time: at + 1000 },
      { text: 'four' },
    ];
    render(<LogView lines={lines} />);
    const times = rows().map((row) => row.querySelector('time')?.textContent ?? null);
    expect(times).toEqual([clockTime(at)?.clock, null, clockTime(at + 1000)?.clock, null]);
    expect(rows()[0]?.querySelector('time')).toHaveAttribute(
      'dateTime',
      new Date(at).toISOString(),
    );
  });

  it('has no time column in a log with no times', () => {
    render(<LogView lines={['a', 'b']} />);
    expect(screen.getByRole('log').querySelector('time')).toBeNull();
  });

  it('keeps a line’s own spacing, as printed', () => {
    render(<LogView lines={['head', '    indented']} />);
    expect(shown()[1]).toBe('    indented');
  });
});

const TRACE = [
  'Container migrate-run Created',
  'error: password authentication failed for user "app_owner"',
  '    at /repo/node_modules/pg-pool/index.js:45:11',
  '    at async migrateDatabase (/repo/src/migrate.ts:23:20)',
  'Node.js v24.21.0',
];

const fold = () => {
  return screen.getByRole('button', { name: /password authentication failed/ });
};

describe('LogView’s multi-line entries', () => {
  it('start open, with a fold on the first line named by it and described by its count', () => {
    render(<LogView lines={TRACE} />);
    expect(fold()).toHaveAttribute('aria-expanded', 'true');
    expect(fold()).toHaveAccessibleDescription('2 lines');
    expect(shown()).toHaveLength(5);
    // Only the entry folds: the lines around it are plain.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('fold under the first line on a click, and open again', async () => {
    render(<LogView lines={TRACE} />);
    await userEvent.click(fold());
    expect(fold()).toHaveAttribute('aria-expanded', 'false');
    expect(shown()).toEqual([TRACE[0], TRACE[1], TRACE[4]]);
    await userEvent.click(fold());
    expect(shown()).toEqual(TRACE);
  });

  it('fold and open from the keyboard, as a button does', async () => {
    render(<LogView lines={TRACE} />);
    fold().focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByText(/migrateDatabase/)).not.toBeInTheDocument();
    await userEvent.keyboard(' ');
    expect(screen.getByText(/migrateDatabase/)).toBeInTheDocument();
  });

  it('point at the lines they fold only while those are drawn', async () => {
    render(<LogView lines={TRACE} />);
    const id = fold().getAttribute('aria-controls');
    expect(document.getElementById(id ?? '')).toHaveTextContent('migrateDatabase');
    await userEvent.click(fold());
    expect(fold()).not.toHaveAttribute('aria-controls');
  });

  it('leave a single line under another unfolded, since folding it would save nothing', () => {
    render(<LogView lines={['error: boom', '    at a (x.js:1:1)', 'after']} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('start folded when asked, and draw flat with no fold at all', () => {
    const { unmount } = render(<LogView lines={TRACE} entries="folded" />);
    expect(fold()).toHaveAttribute('aria-expanded', 'false');
    expect(shown()).toHaveLength(3);
    unmount();
    render(<LogView lines={TRACE} entries="flat" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(shown()).toEqual(TRACE);
  });

  it('keep a fold while lines arrive at the end', async () => {
    const { rerender } = render(<LogView lines={TRACE} />);
    await userEvent.click(fold());
    rerender(<LogView lines={[...TRACE, 'Exited with 1']} />);
    expect(fold()).toHaveAttribute('aria-expanded', 'false');
    expect(shown().at(-1)).toBe('Exited with 1');
  });

  it('keep a fold by the line’s id while the start of a tail moves on', async () => {
    const lines = (from: number): LogLine[] => {
      return TRACE.slice(from).map((text, index) => ({ text, id: `line-${from + index}` }));
    };
    const { rerender } = render(<LogView lines={lines(0)} />);
    await userEvent.click(fold());
    rerender(<LogView lines={lines(1)} />);
    expect(fold()).toHaveAttribute('aria-expanded', 'false');
  });

  it('show a time where it changes from the line shown above, across a fold', async () => {
    const at = new Date(2026, 9, 8, 0, 42, 9).getTime();
    const lines: LogLine[] = [
      { text: 'error: boom', time: at },
      { text: '    at a (x.js:1:1)', time: at + 1000 },
      { text: '    at b (x.js:2:1)', time: at + 1000 },
      { text: 'after', time: at + 1000 },
    ];
    render(<LogView lines={lines} />);
    const times = () => rows().map((row) => row.querySelector('time')?.textContent ?? null);
    expect(times()).toEqual([clockTime(at)?.clock, clockTime(at + 1000)?.clock, null, null]);
    await userEvent.click(screen.getByRole('button', { name: 'error: boom' }));
    // The line that said the time is folded away, so the next one shown says it.
    expect(times()).toEqual([clockTime(at)?.clock, clockTime(at + 1000)?.clock]);
  });
});
