import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Input } from '../input';
import { Textarea } from '../textarea';
import { fieldClass } from './field';

test('a tone colours the border outright, not only on focus', () => {
  // The point of tone on a field is to say something at a glance — a validated
  // value, a warning, an error. A colour that only appears once you focus the
  // field is a colour nobody sees.
  render(<Input tone="success" aria-label="Budget"  value="" onChange={() => {}} />);
  const input = screen.getByLabelText('Budget');
  expect(input).toHaveClass('border-green-9');
  expect(input).not.toHaveClass('border-gray-7');
  // The BORDER is the unconditional part. The ring is not — see below.
  expect(input).not.toHaveClass('ring-3');
});

test('a toned field still has somewhere to go on hover and on focus', () => {
  // The regression: `toned` wore `ring-3 ring-{tone}-3` unconditionally and
  // stepped its border 9→10 on hover. Focus therefore contributed nothing but
  // `outline-none`, and 9→10 is 1.17:1 — so a danger field measured and looked
  // the same at rest, hovered and focused. Every state needs its own delta.
  render(<Input tone="danger" aria-label="Key"  value="" onChange={() => {}} />);
  const input = screen.getByLabelText('Key');
  expect(input).toHaveClass('hover:border-red-11');
  expect(input).toHaveClass('focus:border-red-11', 'focus:ring-3', 'focus:ring-red-3');
  expect(input).not.toHaveClass('hover:border-red-10');
});

test('a toned field keeps its own colour on focus rather than turning accent', () => {
  // The regression this guards: while focus was its own axis, a danger field
  // turned indigo the moment it was focused — hiding the error exactly when
  // the user had gone to fix it.
  render(<Input tone="danger" aria-label="Key"  value="" onChange={() => {}} />);
  const input = screen.getByLabelText('Key');
  expect(input).toHaveClass('border-red-9', 'focus:ring-red-3');
  expect(input).not.toHaveClass('focus:border-indigo-9');
  expect(input).not.toHaveClass('focus:ring-indigo-3');
});

test('tone is what makes a field invalid — nothing else announces it', () => {
  const { rerender } = render(<Input aria-label="Key"  value="" onChange={() => {}} />);
  expect(screen.getByLabelText('Key')).not.toHaveAttribute('aria-invalid');
  rerender(<Input tone="success" aria-label="Key"  value="" onChange={() => {}} />);
  expect(screen.getByLabelText('Key')).not.toHaveAttribute('aria-invalid');
  rerender(<Input tone="danger" aria-label="Key"  value="" onChange={() => {}} />);
  expect(screen.getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true');
});

test('an unset tone is the resting field, not a coloured one', () => {
  // Every input wearing its tone's border would paint the whole form indigo.
  render(<Input aria-label="Title"  value="" onChange={() => {}} />);
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
  const { rerender } = render(<Input size="sm" aria-label="f"  value="" onChange={() => {}} />);
  expect(screen.getByLabelText('f')).toHaveClass('h-28', 'rounded-md', 'text-13', 'px-9');
  rerender(<Input size="md" aria-label="f"  value="" onChange={() => {}} />);
  expect(screen.getByLabelText('f')).toHaveClass('h-36', 'rounded-lg', 'text-14', 'px-12');
  rerender(<Input size="lg" aria-label="f"  value="" onChange={() => {}} />);
  expect(screen.getByLabelText('f')).toHaveClass('h-44', 'rounded-xl', 'text-15', 'px-14');
});

test('textarea rungs set a floor and evict the single-line height', () => {
  const { rerender } = render(<Textarea size="sm" aria-label="body"  value="" onChange={() => {}} />);
  const at = () => screen.getByLabelText('body');
  expect(at()).toHaveClass('h-auto', 'min-h-56');
  expect(at()).not.toHaveClass('h-28');
  rerender(<Textarea size="md" aria-label="body"  value="" onChange={() => {}} />);
  expect(at()).toHaveClass('h-auto', 'min-h-72');
  rerender(<Textarea size="lg" aria-label="body"  value="" onChange={() => {}} />);
  expect(at()).toHaveClass('h-auto', 'min-h-88');
});
