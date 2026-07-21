import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Sparkline } from './sparkline';

const FOURTEEN_DAYS = [3, 5, 4, 7, 6, 9, 5, 11, 8, 13, 10, 16, 12, 18];

test('renders 14 bars', () => {
  render(<Sparkline counts={FOURTEEN_DAYS} />);
  expect(screen.getAllByTestId('sparkline-bar')).toHaveLength(14);
});

test('pads shorter series up to 14 bars', () => {
  render(<Sparkline counts={[1, 2, 3]} />);
  expect(screen.getAllByTestId('sparkline-bar')).toHaveLength(14);
});

test('truncates longer series to the most recent 14 bars', () => {
  const counts = Array.from({ length: 20 }, (_, i) => i);
  render(<Sparkline counts={counts} />);
  expect(screen.getAllByTestId('sparkline-bar')).toHaveLength(14);
});

test('the last bar is not danger-colored when not hot', () => {
  render(<Sparkline counts={FOURTEEN_DAYS} />);
  const bars = screen.getAllByTestId('sparkline-bar');
  expect(bars.at(-1)?.className).not.toMatch(/bg-danger/);
});

test('marks the last bar danger when hot', () => {
  render(<Sparkline counts={FOURTEEN_DAYS} hot />);
  const bars = screen.getAllByTestId('sparkline-bar');
  bars.slice(0, 13).forEach((bar) => expect(bar.className).not.toMatch(/bg-danger/));
  expect(bars.at(-1)?.className).toMatch(/bg-danger/);
});

test('heights are normalized to the max, tallest bar reaching the max height', () => {
  render(<Sparkline counts={FOURTEEN_DAYS} />);
  const bars = screen.getAllByTestId('sparkline-bar');
  const heights = bars.map((bar) => Number.parseFloat(bar.style.height));
  expect(Math.max(...heights)).toBe(heights[13]); // 18 is the max input, last position
  expect(new Set(heights).size).toBeGreaterThan(1); // varied, not flat
});

test('all-zero series still renders visible bars', () => {
  render(<Sparkline counts={new Array(14).fill(0)} />);
  const bars = screen.getAllByTestId('sparkline-bar');
  bars.forEach((bar) => expect(Number.parseFloat(bar.style.height)).toBeGreaterThan(0));
});
