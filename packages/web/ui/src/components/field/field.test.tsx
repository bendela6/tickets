import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Input } from '../input';
import { Textarea } from '../textarea';
import { fieldClass } from './field';

test('the accent follows tone instead of being fixed to indigo', () => {
  render(<Input tone="success" aria-label="Budget" />);
  const input = screen.getByLabelText('Budget');
  expect(input).toHaveClass('focus:border-green-9', 'focus:ring-green-3');
  expect(input).not.toHaveClass('focus:border-indigo-9');
});

test('invalid keeps the danger ring on focus rather than turning accent', () => {
  // The regression this guards: splitting focus into its own axis let an
  // invalid field turn indigo the moment it was focused, hiding the error.
  render(<Input invalid tone="success" aria-label="Key" />);
  const input = screen.getByLabelText('Key');
  expect(input).toHaveClass('border-red-9', 'ring-[3px]', 'ring-red-3');
  expect(input).not.toHaveClass('focus:border-green-9');
  expect(input).not.toHaveClass('focus:ring-green-3');
});

test('composite fields hang the ring on focus-within, plain ones on focus', () => {
  // A tag list or a stepper focuses an inner input, so its shell never matches
  // `:focus` — same ring, different trigger.
  expect(fieldClass({ focus: 'focus-within' })).toContain('focus-within:ring-indigo-3');
  expect(fieldClass({ focus: 'focus-within' })).not.toContain('focus:ring-indigo-3');
  expect(fieldClass()).toContain('focus:ring-indigo-3');
});

test('every rung sets height, radius and font size together', () => {
  const { rerender } = render(<Input size="sm" aria-label="f" />);
  expect(screen.getByLabelText('f')).toHaveClass('h-7', 'rounded-[6px]', 'text-[13px]', 'px-2.25');
  rerender(<Input size="md" aria-label="f" />);
  expect(screen.getByLabelText('f')).toHaveClass('h-9', 'rounded-[8px]', 'text-[14px]', 'px-3');
  rerender(<Input size="lg" aria-label="f" />);
  expect(screen.getByLabelText('f')).toHaveClass('h-11', 'rounded-[10px]', 'text-[15px]', 'px-3.5');
});

test('textarea rungs set a floor and evict the single-line height', () => {
  const { rerender } = render(<Textarea size="sm" aria-label="body" />);
  const at = () => screen.getByLabelText('body');
  expect(at()).toHaveClass('h-auto', 'min-h-14');
  expect(at()).not.toHaveClass('h-7');
  rerender(<Textarea size="md" aria-label="body" />);
  expect(at()).toHaveClass('h-auto', 'min-h-18');
  rerender(<Textarea size="lg" aria-label="body" />);
  expect(at()).toHaveClass('h-auto', 'min-h-22');
});
