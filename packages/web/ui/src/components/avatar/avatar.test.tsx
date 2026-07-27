import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Avatar } from './avatar';

test('agent avatars are square and mono, humans round and sans', () => {
  const { rerender } = render(<Avatar name="claude-worker" kind="agent" />);
  expect(screen.getByTitle('claude-worker')).toHaveClass('rounded-md', 'font-mono');
  rerender(<Avatar name="Mara K." kind="human" />);
  expect(screen.getByTitle('Mara K.')).toHaveClass('rounded-full', 'font-sans');
});

test('each kind keeps the colour it had before tone was a prop', () => {
  const { rerender } = render(<Avatar name="Mara K." kind="human" />);
  expect(screen.getByTitle('Mara K.')).toHaveClass('bg-cyan-3', 'text-cyan-9');
  rerender(<Avatar name="claude-worker" kind="agent" />);
  expect(screen.getByTitle('claude-worker')).toHaveClass('bg-indigo-3', 'text-indigo-9');
});

test('tone repaints without touching shape or typeface', () => {
  render(<Avatar name="Mara K." kind="human" tone="success" />);
  const el = screen.getByTitle('Mara K.');
  expect(el).toHaveClass('bg-green-3', 'text-green-9');
  // The kind axis still owns these — a toned human is still round and sans.
  expect(el).toHaveClass('rounded-full', 'font-sans');
  expect(el).not.toHaveClass('bg-cyan-3');
});

test('the size ladder runs 16 to 36px, defaulting to the 18px rung', () => {
  const { rerender } = render(<Avatar name="M" kind="human" />);
  expect(screen.getByTitle('M')).toHaveClass('size-4.5');
  for (const [size, cls] of [
    ['xs', 'size-4'],
    ['sm', 'size-4.5'],
    ['md', 'size-5.5'],
    ['lg', 'size-7'],
    ['xl', 'size-9'],
  ] as const) {
    rerender(<Avatar name="M" kind="human" size={size} />);
    expect(screen.getByTitle('M')).toHaveClass(cls);
  }
});
