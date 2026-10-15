import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogView } from './log-view';
import type { LogLine, LogSectionOf, LogSectionRule } from './types';
import { clockTime } from './utils/log-lines';

// A deploy's steps start with `==>`, and inside its build, BuildKit's with
// `#1 [stage]`.
const SECTIONS: readonly LogSectionRule[] = [{ match: /^==> / }, { match: /^#\d+ \[/, level: 1 }];

const at = new Date(2026, 9, 8, 0, 46, 1).getTime();

const DEPLOY: LogLine[] = [
  { time: at, text: '==> fetched the commit' },
  { time: at + 1000, text: '==> build' },
  { time: at + 1000, text: '#1 [internal] load definitions' },
  { time: at + 1400, text: '#1 DONE 0.0s' },
  { time: at + 2000, text: '#2 [build 1/2] RUN pnpm install' },
  { time: at + 3000, text: '#2 Done in 9.6s' },
  { time: at + 12000, text: '#2 DONE 10.0s' },
  { time: at + 12000, text: '==> starting' },
  { time: at + 13000, text: 'Container gateway-1 Healthy' },
];

/** The text of the rows shown, in order. */
function shown(): string[] {
  const rows = screen.getByRole('log').querySelectorAll<HTMLElement>('[data-line]');
  return Array.from(rows, (row) => row.querySelector('[id]')?.textContent ?? '');
}

/** A section's fold, by its first line. */
const fold = (title: string) => screen.getByRole('button', { name: title });

/** What the screen reader was last told. */
const news = () => screen.getByRole('status').textContent;

afterEach(() => {
  vi.useRealTimers();
});

describe('LogView’s sections', () => {
  it('draw each one’s first line, folded unless it holds the last line', () => {
    render(<LogView lines={DEPLOY} sections={SECTIONS} />);
    expect(shown()).toEqual([
      '==> fetched the commit',
      '==> build',
      '==> starting',
      'Container gateway-1 Healthy',
    ]);
    expect(fold('==> build')).toHaveAttribute('aria-expanded', 'false');
    expect(fold('==> starting')).toHaveAttribute('aria-expanded', 'true');
    // A section with no lines under its first has nothing to fold.
    expect(screen.queryByRole('button', { name: '==> fetched the commit' })).toBeNull();
  });

  it('open and fold at the chevron, their lines a group named by the first', async () => {
    render(<LogView lines={DEPLOY} sections={SECTIONS} />);
    expect(fold('==> build')).not.toHaveAttribute('aria-controls');
    await userEvent.click(fold('==> build'));
    expect(fold('==> build')).toHaveAttribute('aria-expanded', 'true');
    const group = screen.getByRole('group', { name: '==> build' });
    expect(fold('==> build')).toHaveAttribute('aria-controls', group.id);
    expect(
      within(group).getByRole('button', { name: '#1 [internal] load definitions' }),
    ).toBeTruthy();
    await userEvent.click(fold('==> build'));
    expect(screen.queryByRole('group', { name: '==> build' })).toBeNull();
    expect(shown()).not.toContain('#1 [internal] load definitions');
  });

  it('fold and open from the keyboard, as a button does', async () => {
    render(<LogView lines={DEPLOY} sections={SECTIONS} />);
    fold('==> build').focus();
    await userEvent.keyboard('{Enter}');
    expect(fold('==> build')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.tab();
    expect(fold('#1 [internal] load definitions')).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(shown()).toContain('#1 DONE 0.0s');
  });

  it('nest one inside another, each keeping its fold while the other is folded', async () => {
    render(<LogView lines={DEPLOY} sections={SECTIONS} />);
    await userEvent.click(fold('==> build'));
    const build = screen.getByRole('group', { name: '==> build' });
    await userEvent.click(within(build).getByRole('button', { name: /^#2/ }));
    expect(within(build).getByRole('group', { name: /^#2/ })).toHaveTextContent('#2 Done in 9.6s');
    await userEvent.click(fold('==> build'));
    await userEvent.click(fold('==> build'));
    expect(fold('#2 [build 1/2] RUN pnpm install')).toHaveAttribute('aria-expanded', 'true');
  });

  it('say how each went and how long it took, to the next one', async () => {
    render(<LogView lines={DEPLOY} sections={SECTIONS} />);
    expect(fold('==> build')).toHaveAccessibleDescription('Done, 11 s');
    // At the log's end, to its own last line.
    expect(fold('==> starting')).toHaveAccessibleDescription('Done, 1 s');
    await userEvent.click(fold('==> build'));
    expect(fold('#1 [internal] load definitions')).toHaveAccessibleDescription('Done, 1 s');
    expect(fold('#2 [build 1/2] RUN pnpm install')).toHaveAccessibleDescription('Done, 10 s');
  });

  it('say tenths of a second under ten seconds, and only the state with no times', () => {
    const quick: LogLine[] = [
      { time: at, text: '==> one' },
      { time: at + 100, text: 'a' },
      { time: at + 400, text: '==> two' },
      { time: at + 500, text: 'b' },
    ];
    const { unmount } = render(<LogView lines={quick} sections={SECTIONS} />);
    expect(fold('==> one')).toHaveAccessibleDescription('Done, 0.4 s');
    unmount();
    render(<LogView lines={quick.map(({ text }) => text)} sections={SECTIONS} />);
    expect(fold('==> one')).toHaveAccessibleDescription('Done');
  });

  it('fail once they hold an error line, and start open then', () => {
    const failing = [...DEPLOY];
    failing.splice(5, 0, { time: at + 2500, text: 'error: password authentication failed' });
    render(<LogView lines={failing} sections={SECTIONS} />);
    expect(fold('==> build')).toHaveAttribute('aria-expanded', 'true');
    expect(fold('==> build')).toHaveAccessibleDescription(/^Failed/);
    expect(fold('#2 [build 1/2] RUN pnpm install')).toHaveAccessibleDescription(/^Failed/);
    expect(fold('#1 [internal] load definitions')).toHaveAccessibleDescription(/^Done/);
  });

  it('start open or folded as the app says', () => {
    const rules: LogSectionRule[] = [
      { match: /^==> build/, start: 'open' },
      { match: /^==> /, start: 'folded' },
      { match: /^#\d+ \[/, level: 1 },
    ];
    render(<LogView lines={DEPLOY} sections={rules} />);
    expect(fold('==> build')).toHaveAttribute('aria-expanded', 'true');
    expect(fold('==> starting')).toHaveAttribute('aria-expanded', 'false');
  });

  it('come from a function as well as from rules', () => {
    const sectionOf: LogSectionOf = (text) => {
      return text.startsWith('==> ') ? {} : undefined;
    };
    render(<LogView lines={DEPLOY} sections={sectionOf} />);
    // No level-1 rule: BuildKit's steps are plain lines of the build.
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toHaveLength(2);
    expect(fold('==> build')).toHaveAttribute('aria-expanded', 'false');
  });

  it('show a time where it changes from the row shown above, as folds open', async () => {
    render(<LogView lines={DEPLOY} sections={SECTIONS} />);
    const times = () => {
      return Array.from(
        screen.getByRole('log').querySelectorAll('[data-line]'),
        (row) => row.querySelector('time')?.textContent ?? null,
      );
    };
    const clock = (offset: number) => clockTime(at + offset)?.clock;
    expect(times()).toEqual([clock(0), clock(1000), clock(12000), clock(13000)]);
    await userEvent.click(fold('==> build'));
    // #1 is in the build's second; #2 starts the next.
    expect(times()).toEqual([clock(0), clock(1000), null, clock(2000), clock(12000), clock(13000)]);
  });

  it('keep entries folding inside them', async () => {
    const lines = [
      '==> migrate',
      'error: password authentication failed',
      '    at a (x.js:1:1)',
      '    at b (x.js:2:1)',
      'Node.js v24.21.0',
    ];
    render(<LogView lines={lines} sections={SECTIONS} />);
    const entry = screen.getByRole('button', { name: 'error: password authentication failed' });
    expect(entry).toHaveAccessibleDescription('2 lines');
    await userEvent.click(entry);
    expect(shown()).toEqual([lines[0], lines[1], lines[4]]);
  });
});

describe('LogView’s sections while a log streams', () => {
  const upTo = (count: number) => DEPLOY.slice(0, count);

  it('keep the running one open, its time ticking, and fold it once it is through', () => {
    vi.useFakeTimers({ now: at + 2500, toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { rerender } = render(<LogView lines={upTo(6)} sections={SECTIONS} streaming />);
    expect(fold('==> build')).toHaveAttribute('aria-expanded', 'true');
    expect(fold('==> build')).toHaveAccessibleDescription('Running, 1 s');
    expect(fold('#2 [build 1/2] RUN pnpm install')).toHaveAccessibleDescription('Running, 0 s');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(fold('==> build')).toHaveAccessibleDescription('Running, 3 s');
    rerender(<LogView lines={upTo(8)} sections={SECTIONS} streaming />);
    expect(fold('==> build')).toHaveAttribute('aria-expanded', 'false');
    expect(fold('==> build')).toHaveAccessibleDescription('Done, 11 s');
  });

  it('keep one the reader opened open once it is through', async () => {
    const { rerender } = render(<LogView lines={upTo(6)} sections={SECTIONS} streaming />);
    // Fold it, then open it: the reader's own choice now.
    await userEvent.click(fold('==> build'));
    await userEvent.click(fold('==> build'));
    rerender(<LogView lines={upTo(8)} sections={SECTIONS} streaming />);
    expect(fold('==> build')).toHaveAttribute('aria-expanded', 'true');
  });

  it('finish the last when the log stops streaming', () => {
    const { rerender } = render(<LogView lines={DEPLOY} sections={SECTIONS} streaming />);
    expect(fold('==> starting')).toHaveAccessibleDescription(/^Running/);
    rerender(<LogView lines={DEPLOY} sections={SECTIONS} />);
    expect(fold('==> starting')).toHaveAccessibleDescription('Done, 1 s');
  });
});

describe('what a screen reader hears while a log streams', () => {
  const upTo = (count: number) => DEPLOY.slice(0, count);

  it('is not each line: the log is not a live region, its status is', () => {
    render(<LogView lines={DEPLOY} sections={SECTIONS} streaming />);
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'off');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('is a section starting and finishing, never a line', () => {
    const { rerender } = render(<LogView lines={upTo(1)} sections={SECTIONS} streaming />);
    expect(news()).toBe('');
    rerender(<LogView lines={upTo(3)} sections={SECTIONS} streaming />);
    expect(news()).toBe(
      'Finished: ==> fetched the commit, in 1 s. Started: ==> build. Started: #1 [internal] load definitions.',
    );
    rerender(<LogView lines={upTo(5)} sections={SECTIONS} streaming />);
    expect(news()).toBe(
      'Finished: #1 [internal] load definitions, in 1 s. Started: #2 [build 1/2] RUN pnpm install.',
    );
    // A plain line says nothing new.
    rerender(<LogView lines={upTo(6)} sections={SECTIONS} streaming />);
    expect(news()).not.toContain('Done in 9.6s');
    expect(news()).toContain('Started: #2 [build 1/2] RUN pnpm install.');
    rerender(<LogView lines={upTo(8)} sections={SECTIONS} streaming />);
    expect(news()).toBe(
      'Finished: ==> build, in 11 s. Finished: #2 [build 1/2] RUN pnpm install, in 10 s. Started: ==> starting.',
    );
    rerender(<LogView lines={upTo(9)} sections={SECTIONS} />);
    expect(news()).toBe('Finished: ==> starting, in 1 s.');
  });

  it('is a failure, once, said by the innermost section that failed', () => {
    const { rerender } = render(<LogView lines={upTo(5)} sections={SECTIONS} streaming />);
    const failing = [...upTo(5), { time: at + 2500, text: 'error: boom' }];
    rerender(<LogView lines={failing} sections={SECTIONS} streaming />);
    expect(news()).toBe('Failed: #2 [build 1/2] RUN pnpm install.');
    // Through, a failed section is not said again to have finished.
    rerender(
      <LogView
        lines={[...failing, { time: at + 12000, text: '==> starting' }]}
        sections={SECTIONS}
        streaming
      />,
    );
    expect(news()).toBe('Started: ==> starting.');
  });
});
