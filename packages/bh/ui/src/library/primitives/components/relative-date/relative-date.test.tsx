import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
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
