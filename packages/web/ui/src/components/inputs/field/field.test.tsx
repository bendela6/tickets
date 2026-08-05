import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { focusRing } from '../../../style';
import { Input } from '../input';
import { Textarea } from '../textarea';
import { fieldClass } from './field';

// None of these name a rung. A test that spells out `-9` or `-11` fails the
// moment a designer moves a value and can only ever catch someone copying the
// number wrong twice, so what is asserted here is the WIRING: which ramp a
// state paints from, which pseudo-class the ring hangs off, and that the three
// interaction states are distinct from one another. `focusRing()` is the single
// definition, so referring to it keeps these honest for free.
const rung = (className: string, pattern: RegExp) => className.match(pattern)?.[1];

test('a tone colours the border outright, not only on focus', () => {
  // The point of tone on a field is to say something at a glance — a validated
  // value, a warning, an error. A colour that only appears once you focus the
  // field is a colour nobody sees.
  render(<Input tone="success" aria-label="Budget"  value="" onChange={() => {}} />);
  const input = screen.getByLabelText('Budget');
  expect(input.className).toMatch(/(?:^|\s)border-green-\d/);
  expect(input).not.toHaveClass('border-gray-7');
  // The BORDER is the unconditional part. The ring is not — it belongs to focus,
  // and an always-on ring leaves focus with nothing to add.
  expect(input.className).not.toMatch(/(?:^|\s)ring-\d/);
});

test('a toned field still has somewhere to go on hover and on focus', () => {
  // The regression: `toned` wore its ring unconditionally and moved its border
  // by a single rung on hover, so a danger field measured identically at rest,
  // hovered and focused. Asserted as a shape — three states, three appearances —
  // rather than as three numbers.
  render(<Input tone="danger" aria-label="Key"  value="" onChange={() => {}} />);
  const { className } = screen.getByLabelText('Key');

  const rest = rung(className, /(?:^|\s)border-red-(\d+)/);
  const hover = rung(className, /hover:border-red-(\d+)/);
  expect(rest).toBeDefined();
  expect(hover).toBeDefined();
  expect(hover).not.toBe(rest);
  expect(className).toContain(focusRing('red', 'focus'));
});

test('a toned field keeps its own colour on focus rather than turning accent', () => {
  // The regression this guards: while focus was its own axis, a danger field
  // turned indigo the moment it was focused — hiding the error exactly when
  // the user had gone to fix it.
  render(<Input tone="danger" aria-label="Key"  value="" onChange={() => {}} />);
  const input = screen.getByLabelText('Key');
  expect(input.className).toContain(focusRing('red', 'focus'));
  expect(input.className).not.toContain(focusRing('indigo', 'focus'));
  expect(input).not.toHaveClass('focus:border-indigo-9');
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
  expect(input.className).toMatch(/(?:^|\s)border-gray-\d/);
  expect(input.className).toMatch(/hover:border-gray-\d/);
  expect(input).not.toHaveClass('border-indigo-9');
  // …but the focus ring still follows the accent.
  expect(input.className).toContain(focusRing('indigo', 'focus'));
});

test('composite fields hang the ring on focus-within, plain ones on focus', () => {
  // A tag list or a stepper focuses an inner input, so its shell never matches
  // `:focus` — same ring, different trigger. The trigger is the contract; the
  // ring's own appearance is `focusRing`'s business, not this test's.
  expect(fieldClass({ focus: 'focus-within' })).toContain(focusRing('indigo', 'focus-within'));
  expect(fieldClass({ focus: 'focus-within' })).not.toContain(focusRing('indigo', 'focus'));
  expect(fieldClass()).toContain(focusRing('indigo', 'focus'));
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
