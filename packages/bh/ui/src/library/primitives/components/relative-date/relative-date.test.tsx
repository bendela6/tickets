import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { formatDateTime } from '@bh/template';
import { RelativeDate } from './relative-date';

const NOW = new Date('2026-07-06T09:00:00Z');

test('future date reads "in N days" with exact date title', () => {
  render(<RelativeDate value="2026-07-13T09:00:00Z" now={NOW} />);
  const el = screen.getByText(/in 7 days/i);
  expect(el).toHaveAttribute('title', expect.stringMatching(/Jul 13, 2026/));
});

test('past date reads "N days ago"', () => {
  render(<RelativeDate value="2026-07-03T09:00:00Z" now={NOW} />);
  expect(screen.getByText(/3 days ago/i)).toBeInTheDocument();
});

describe('with a locale', () => {
  test('RelativeDate writes its label and its title in the locale', () => {
    render(<RelativeDate value="2026-07-09T09:00:00Z" now={NOW} locale="de" />);
    expect(screen.getByText('in 3 Tagen')).toHaveAttribute('title', '09.07.2026');
  });
});

describe('in minutes and hours', () => {
  test('RelativeDate has the date and time as its title', () => {
    render(<RelativeDate value="2026-07-06T08:55:00Z" now={NOW} smallestUnit="minute" />);
    expect(screen.getByText('5 minutes ago')).toHaveAttribute(
      'title',
      formatDateTime('2026-07-06T08:55:00Z'),
    );
  });

  test('RelativeDate writes its label and its title in the locale', () => {
    render(
      <RelativeDate value="2026-07-06T08:55:00Z" now={NOW} smallestUnit="minute" locale="de" />,
    );
    expect(screen.getByText('vor 5 Minuten')).toHaveAttribute(
      'title',
      formatDateTime('2026-07-06T08:55:00Z', { locale: 'de' }),
    );
  });
});

describe('RelativeDate in minutes keeps itself current', () => {
  // Twenty seconds into 09:00 UTC.
  const START = Date.parse('2026-07-06T09:00:20Z');

  /** Moves the clock on by `ms`, and renders what that changed. */
  function wait(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  /** Draws a label in minutes counted from the clock, and reads it back. */
  function shown(value: string) {
    const { container, unmount } = render(<RelativeDate value={value} smallestUnit="minute" />);
    return { label: () => container.textContent, unmount };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test('ticks on each minute under an hour away', () => {
    const { label } = shown('2026-07-06T09:00:00Z');
    expect(label()).toBe('just now');
    wait(39_999);
    expect(label()).toBe('just now');
    wait(1);
    expect(label()).toBe('1 minute ago');
    wait(60_000);
    expect(label()).toBe('2 minutes ago');
    expect(vi.getTimerCount()).toBe(1);
  });

  test('ticks on each hour under a day away, not each minute', () => {
    // An hour and a half ago: two hours by 09:30, but its clock turns on the hour.
    const { label } = shown('2026-07-06T07:30:00Z');
    expect(label()).toBe('1 hour ago');
    wait(59 * 60_000 + 39_999);
    expect(label()).toBe('1 hour ago');
    wait(1);
    expect(label()).toBe('2 hours ago');
  });

  test('moves from minutes to hours on its own clock', () => {
    const { label } = shown('2026-07-06T08:01:00Z');
    expect(label()).toBe('59 minutes ago');
    wait(40_000);
    expect(label()).toBe('1 hour ago');
    // The minute's timer has gone with the minutes, and the hour's is in its place.
    expect(vi.getTimerCount()).toBe(1);
    wait(59 * 60_000);
    expect(label()).toBe('1 hour ago');
    wait(60 * 60_000);
    expect(label()).toBe('2 hours ago');
  });

  test('counts a moment to come down to just now, and on past it', () => {
    const { label } = shown('2026-07-06T09:02:00Z');
    expect(label()).toBe('in 1 minute');
    wait(40_000);
    expect(label()).toBe('in 1 minute');
    wait(60_000);
    expect(label()).toBe('just now');
    wait(60_000);
    expect(label()).toBe('1 minute ago');
  });

  test('stops once a moment is a day away', () => {
    const { label } = shown('2026-07-05T09:30:00Z');
    expect(label()).toBe('23 hours ago');
    expect(vi.getTimerCount()).toBe(1);
    wait(59 * 60_000 + 40_000);
    expect(label()).toBe('yesterday');
    expect(vi.getTimerCount()).toBe(0);
  });

  test('keeps no timer a day away, in days, or given now', () => {
    render(<RelativeDate value="2026-07-05T08:00:00Z" smallestUnit="minute" />);
    render(<RelativeDate value="2026-07-06T08:00:00Z" />);
    render(<RelativeDate value="2026-07-06T08:00:00Z" now={NOW} smallestUnit="minute" />);
    expect(screen.getByText('yesterday')).toBeInTheDocument();
    expect(screen.getByText('today')).toBeInTheDocument();
    expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('shares one timer among the labels at one step, and leaves none once gone', () => {
    const first = shown('2026-07-06T08:55:00Z');
    const second = shown('2026-07-06T08:30:00Z');
    expect(vi.getTimerCount()).toBe(1);
    const third = shown('2026-07-06T05:00:00Z');
    expect(vi.getTimerCount()).toBe(2);
    first.unmount();
    second.unmount();
    third.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
