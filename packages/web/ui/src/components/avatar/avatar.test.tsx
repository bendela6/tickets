import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Avatar } from './avatar';

test('shape and typeface are independent axes', () => {
  // Neither implies the other: a square avatar in sans is a legitimate
  // combination, which is why these were split out of a single `kind`.
  const { rerender } = render(<Avatar name="Mara K." />);
  expect(screen.getByTitle('Mara K.')).toHaveClass('rounded-full', 'font-sans');
  rerender(<Avatar name="Mara K." shape="square" />);
  expect(screen.getByTitle('Mara K.')).toHaveClass('rounded-md', 'font-sans');
  rerender(<Avatar name="Mara K." shape="round" font="mono" />);
  expect(screen.getByTitle('Mara K.')).toHaveClass('rounded-full', 'font-mono');
});

test('tone repaints without touching shape or typeface', () => {
  render(<Avatar name="Mara K." tone="success" />);
  const el = screen.getByTitle('Mara K.');
  expect(el).toHaveClass('bg-green-3', 'text-green-9');
  expect(el).toHaveClass('rounded-full', 'font-sans');
});

test('the size ladder runs 16 to 36px, defaulting to the 18px rung', () => {
  const { rerender } = render(<Avatar name="M" />);
  expect(screen.getByTitle('M')).toHaveClass('size-18');
  for (const [size, cls] of [
    ['xs', 'size-16'],
    ['sm', 'size-18'],
    ['md', 'size-22'],
    ['lg', 'size-28'],
    ['xl', 'size-36'],
  ] as const) {
    rerender(<Avatar name="M" size={size} />);
    expect(screen.getByTitle('M')).toHaveClass(cls);
  }
});

test('takes initials from the first two words', () => {
  render(<Avatar name="Mara Kowalski" />);
  expect(screen.getByTitle('Mara Kowalski').textContent).toBe('MK');
});
