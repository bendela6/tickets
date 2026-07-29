import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Input } from '../input';
import { Textarea } from '../textarea';
import { fieldClass } from './field';

test('a tone colours the border outright, not only on focus', () => {
  // The point of tone on a field is to say something at a glance — a validated
  // value, a warning, an error. A colour that only appears once you focus the
  // field is a colour nobody sees.
  render(<Input tone="success" aria-label="Budget" />);
  const input = screen.getByLabelText('Budget');
  expect(input).toHaveClass('border-green-9', 'ring-green-3');
  expect(input).not.toHaveClass('border-gray-7');
});

test('a toned field keeps its own colour on focus rather than turning accent', () => {
  // The regression this guards: while focus was its own axis, a danger field
  // turned indigo the moment it was focused — hiding the error exactly when
  // the user had gone to fix it.
  render(<Input tone="danger" aria-label="Key" />);
  const input = screen.getByLabelText('Key');
  expect(input).toHaveClass('border-red-9', 'ring-[3px]', 'ring-red-3');
  expect(input).not.toHaveClass('focus:border-indigo-9');
  expect(input).not.toHaveClass('focus:ring-indigo-3');
});

test('tone is what makes a field invalid — nothing else announces it', () => {
  const { rerender } = render(<Input aria-label="Key" />);
  expect(screen.getByLabelText('Key')).not.toHaveAttribute('aria-invalid');
  rerender(<Input tone="success" aria-label="Key" />);
  expect(screen.getByLabelText('Key')).not.toHaveAttribute('aria-invalid');
  rerender(<Input tone="danger" aria-label="Key" />);
  expect(screen.getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true');
});

test('an unset tone is the resting field, not a coloured one', () => {
  // Every input wearing its tone's border would paint the whole form indigo.
  render(<Input aria-label="Title" />);
  const input = screen.getByLabelText('Title');
  expect(input).toHaveClass('border-gray-7', 'hover:border-gray-9');
  expect(input).not.toHaveClass('border-indigo-9');
  // …but the focus ring still follows the accent.
  expect(input).toHaveClass('focus:ring-indigo-3');
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
  expect(screen.getByLabelText('f')).toHaveClass('h-7', 'rounded-md', 'text-13', 'px-2.25');
  rerender(<Input size="md" aria-label="f" />);
  expect(screen.getByLabelText('f')).toHaveClass('h-9', 'rounded-lg', 'text-14', 'px-3');
  rerender(<Input size="lg" aria-label="f" />);
  expect(screen.getByLabelText('f')).toHaveClass('h-11', 'rounded-xl', 'text-15', 'px-3.5');
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
