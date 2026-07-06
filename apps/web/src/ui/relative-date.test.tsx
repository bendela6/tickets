import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
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
