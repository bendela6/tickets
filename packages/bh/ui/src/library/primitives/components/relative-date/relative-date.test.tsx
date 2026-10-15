import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { formatDateTime } from './format-date-time';
import { formatExact, RelativeDate, relativeLabel } from './relative-date';

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

describe('without a locale, bh writes its own English', () => {
  test('relativeLabel counts whole UTC days', () => {
    const labels = ['2026-07-03', '2026-07-05T23:59:00Z', '2026-07-06T23:00:00Z', '2026-07-07'];
    expect(labels.map((value) => relativeLabel(value, NOW))).toEqual([
      '3 days ago',
      'yesterday',
      'today',
      'tomorrow',
    ]);
    expect(relativeLabel('2026-07-13', NOW, {})).toBe('in 7 days');
  });

  test('formatExact writes the UTC day, the month in three letters', () => {
    expect(formatExact('2026-01-05T00:00:00Z')).toBe('Jan 5, 2026');
    expect(formatExact('2026-09-30T23:30:00Z')).toBe('Sep 30, 2026');
    expect(formatExact('2026-12-31', {})).toBe('Dec 31, 2026');
  });
});

describe('with a locale', () => {
  test("relativeLabel writes the locale's words, near days included", () => {
    const values = [
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
      '2026-07-06',
      '2026-07-07',
      '2026-07-09',
    ];
    expect(values.map((value) => relativeLabel(value, NOW, { locale: 'de' }))).toEqual([
      'vor 3 Tagen',
      'vorgestern',
      'gestern',
      'heute',
      'morgen',
      'in 3 Tagen',
    ]);
    expect(relativeLabel('2026-07-07', NOW, { locale: 'ka' })).toBe('ხვალ');
  });

  test("formatExact writes the locale's medium date, still the UTC day", () => {
    expect(formatExact('2026-07-13T23:30:00Z', { locale: 'en-GB' })).toBe('13 Jul 2026');
    expect(formatExact('2026-07-13T23:30:00Z', { locale: 'de' })).toBe('13.07.2026');
    expect(formatExact('2026-07-13', { locale: 'en-US' })).toBe(formatExact('2026-07-13'));
  });

  test("ignores a tag Intl cannot read, writing bh's English", () => {
    expect(relativeLabel('2026-07-09', NOW, { locale: 'en_US' })).toBe('in 3 days');
    expect(formatExact('2026-07-13', { locale: 'en_US' })).toBe('Jul 13, 2026');
  });

  test('hands back a value no Date can read as written, where Intl would throw', () => {
    expect(relativeLabel('not a date', NOW, { locale: 'de' })).toBe('not a date');
    expect(formatExact('not a date', { locale: 'de' })).toBe('not a date');
  });

  test('RelativeDate writes its label and its title in the locale', () => {
    render(<RelativeDate value="2026-07-09T09:00:00Z" now={NOW} locale="de" />);
    expect(screen.getByText('in 3 Tagen')).toHaveAttribute('title', '09.07.2026');
  });
});

describe('in minutes and hours', () => {
  const inMinutes = (value: string) => relativeLabel(value, NOW, { smallestUnit: 'minute' });

  test('relativeLabel counts a moment under a day away in whole minutes and hours', () => {
    const past = [
      '2026-07-06T08:59:30Z',
      '2026-07-06T08:59:00Z',
      '2026-07-06T08:54:01Z',
      '2026-07-06T08:00:01Z',
      '2026-07-06T08:00:00Z',
      '2026-07-06T07:00:01Z',
      '2026-07-05T09:00:01Z',
    ];
    expect(past.map(inMinutes)).toEqual([
      'just now',
      '1 minute ago',
      '5 minutes ago',
      '59 minutes ago',
      '1 hour ago',
      '1 hour ago',
      '23 hours ago',
    ]);
    const coming = ['2026-07-06T09:00:45Z', '2026-07-06T09:01:00Z', '2026-07-06T09:05:59Z'];
    expect(coming.map(inMinutes)).toEqual(['just now', 'in 1 minute', 'in 5 minutes']);
    expect(inMinutes('2026-07-06T11:00:00Z')).toBe('in 2 hours');
  });

  test('counts calendar days in UTC a day or more away, as before', () => {
    const values = [
      '2026-07-04T10:00:00Z',
      '2026-07-05T09:00:00Z',
      '2026-07-07T09:00:00Z',
      '2026-07-13T09:00:00Z',
    ];
    expect(values.map(inMinutes)).toEqual(['2 days ago', 'yesterday', 'tomorrow', 'in 7 days']);
  });

  test('is asked for: in days, the default, an hour ago is still today', () => {
    expect(relativeLabel('2026-07-06T08:00:00Z', NOW)).toBe('today');
    expect(relativeLabel('2026-07-06T08:00:00Z', NOW, { smallestUnit: 'day' })).toBe('today');
  });

  test("writes the locale's words, its own for now", () => {
    const inGerman = (value: string) => {
      return relativeLabel(value, NOW, { smallestUnit: 'minute', locale: 'de' });
    };
    const values = [
      '2026-07-06T08:59:30Z',
      '2026-07-06T08:55:00Z',
      '2026-07-06T08:00:00Z',
      '2026-07-06T11:00:00Z',
    ];
    expect(values.map(inGerman)).toEqual([
      'jetzt',
      'vor 5 Minuten',
      'vor 1 Stunde',
      'in 2 Stunden',
    ]);
    expect(
      relativeLabel('2026-07-06T08:59:30Z', NOW, { smallestUnit: 'minute', locale: 'en-US' }),
    ).toBe('now');
    expect(
      relativeLabel('2026-07-06T08:55:00Z', NOW, { smallestUnit: 'minute', locale: 'ka' }),
    ).toBe('5 წუთის წინ');
  });

  test("writes bh's English for a tag Intl cannot read, and hands back what no Date can read", () => {
    expect(
      relativeLabel('2026-07-06T08:59:30Z', NOW, { smallestUnit: 'minute', locale: 'en_US' }),
    ).toBe('just now');
    expect(relativeLabel('not a date', NOW, { smallestUnit: 'minute', locale: 'de' })).toBe(
      'not a date',
    );
  });

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
