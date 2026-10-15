import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogView } from './log-view';
import type { LogLine } from './types';

// jsdom lays nothing out, so the page is drawn here: a window 600 pixels
// high, and the log, 20 pixels a row, at `top`, which a scroll moves.
const VIEW = 600;
const ROW = 20;
let top = 0;

/** Scrolls the page by `by` pixels: the log moves the other way. */
function scrollPage(by: number) {
  top -= by;
  act(() => {
    document.dispatchEvent(new Event('scroll'));
  });
}

function logBottom(): number {
  return screen.getByRole('log').getBoundingClientRect().bottom;
}

const scrollBy = vi.fn((options: ScrollToOptions) => {
  top -= options.top ?? 0;
});

beforeEach(() => {
  top = 0;
  scrollBy.mockClear();
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(VIEW);
  window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const height =
      this.getAttribute('role') === 'log' ? this.querySelectorAll('[data-line]').length * ROW : 0;
    return new DOMRect(0, top, 800, height);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const lines = (count: number, from = 0): LogLine[] => {
  return Array.from({ length: count }, (_, index) => {
    return {
      id: `line-${from + index}`,
      text: `line ${from + index}`,
    };
  });
};

const jump = () => screen.queryByRole('button', { name: /Jump to the end/ });

describe('LogView following the end', () => {
  it('keeps the page at the log’s end while lines arrive', () => {
    const { rerender } = render(<LogView lines={lines(25)} />);
    expect(scrollBy).not.toHaveBeenCalled();
    rerender(<LogView lines={lines(40)} />);
    expect(scrollBy).toHaveBeenCalledWith({ top: 200, behavior: 'instant' });
    expect(logBottom()).toBe(VIEW);
    rerender(<LogView lines={lines(41)} />);
    expect(logBottom()).toBe(VIEW);
  });

  it('stops once the reader scrolls up, counts what arrives, and jumps back', async () => {
    const { rerender } = render(<LogView lines={lines(40)} />);
    scrollPage(-300);
    rerender(<LogView lines={lines(43)} />);
    expect(scrollBy).not.toHaveBeenCalled();
    expect(jump()).toHaveTextContent('3 new lines · Jump to the end');
    rerender(<LogView lines={lines(44)} />);
    expect(jump()).toHaveTextContent('4 new lines · Jump to the end');
    await userEvent.click(jump() as HTMLElement);
    expect(logBottom()).toBe(VIEW);
    expect(jump()).toBeNull();
    // Following again.
    rerender(<LogView lines={lines(46)} />);
    expect(logBottom()).toBe(VIEW);
  });

  it('follows again once the reader scrolls back down to the end', () => {
    const { rerender } = render(<LogView lines={lines(40)} />);
    scrollPage(-300);
    rerender(<LogView lines={lines(42)} />);
    expect(jump()).not.toBeNull();
    scrollPage(logBottom() - VIEW);
    expect(jump()).toBeNull();
    rerender(<LogView lines={lines(45)} />);
    expect(logBottom()).toBe(VIEW);
  });

  it('never moves the page for a fold opened', async () => {
    const trace = [
      'error: boom',
      ...Array.from({ length: 30 }, (_, index) => `    at f${index} (x.js:1:1)`),
    ];
    render(<LogView lines={trace} entries="folded" />);
    await userEvent.click(screen.getByRole('button', { name: 'error: boom' }));
    expect(logBottom()).toBeGreaterThan(VIEW);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('counts a tail’s new lines by their ids while its start moves on', () => {
    const { rerender } = render(<LogView lines={lines(40)} />);
    scrollPage(-300);
    rerender(<LogView lines={lines(40, 5)} />);
    expect(jump()).toHaveTextContent('5 new lines · Jump to the end');
  });

  it('counts nothing while the log is below what the reader sees, not yet reached', () => {
    const { rerender } = render(<LogView lines={lines(40)} />);
    scrollPage(-700);
    rerender(<LogView lines={lines(42)} />);
    expect(jump()).toBeNull();
    expect(scrollBy).not.toHaveBeenCalled();
    // Reaching it, the reader sees no count of what came before.
    scrollPage(400);
    expect(jump()).toBeNull();
  });

  it('shows no way back while the reader is past the log, reading below it', () => {
    const { rerender } = render(<LogView lines={lines(40)} />);
    scrollPage(logBottom() + 100);
    rerender(<LogView lines={lines(42)} />);
    expect(jump()).toBeNull();
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
