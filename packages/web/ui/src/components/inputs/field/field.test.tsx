import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { focusRing } from '../../../style';
import { Input } from '../input';
import { Textarea } from '../textarea';
import { CONTROL_LADDER, fieldClass } from './field';

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
  // The tone paints the FLOOR, and — since 2026-08-06 — a hairline rim too.
  // A toned field is the one place a resting field is bordered; that rim is how
  // it reads as toned before you reach its glyph.
  expect(input.className).toMatch(/(?:^|\s)bg-green-\d/);
  expect(input.className).toMatch(/(?:^|\s)border-green-\d/);
  expect(input.className).not.toMatch(/(?:^|\s)bg-gray-\d/);
  expect(input).not.toHaveClass('border-transparent');
  // The floor and rim are the unconditional part. The ring is not — it belongs
  // to focus, and an always-on ring leaves focus with nothing to add.
  expect(input.className).not.toMatch(/(?:^|\s)ring-\d/);
});

test('an unset field stays rimless, which is what keeps a stacked form quiet', () => {
  // The other half of the same rule: only a field with something to say draws
  // an edge at rest. Every field bordered would be the rim noise the design
  // gave up borders to avoid.
  render(<Input aria-label="Title" value="" onChange={() => {}} />);
  expect(screen.getByLabelText('Title')).toHaveClass('border-transparent');
});

test('a toned field still has somewhere to go on hover and on focus', () => {
  // The regression: `toned` wore its ring unconditionally and moved its border
  // by a single rung on hover, so a danger field measured identically at rest,
  // hovered and focused. Asserted as a shape — three states, three appearances —
  // rather than as three numbers.
  render(<Input tone="danger" aria-label="Key"  value="" onChange={() => {}} />);
  const { className } = screen.getByLabelText('Key');

  const rest = rung(className, /(?:^|\s)bg-red-(\d+)/);
  const hover = rung(className, /hover:bg-red-(\d+)/);
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
  expect(input.className).toMatch(/(?:^|\s)bg-gray-\d/);
  expect(input.className).toMatch(/hover:bg-gray-\d/);
  expect(input.className).not.toMatch(/(?:^|\s)bg-indigo-\d/);
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

test('every rung sets height, radius, font size and padding together', () => {
  // Reads the ladder rather than restating it: the design moves these numbers
  // and this test should follow, not block. What it guards is that a rung sets
  // all four — a control that took the height and kept its own padding is the
  // failure this catches.
  for (const size of ['xs', 'md', 'lg'] as const) {
    const { unmount } = render(<Input size={size} aria-label="f" value="" onChange={() => {}} />);
    const rung = CONTROL_LADDER[size];
    expect(screen.getByLabelText('f'), size).toHaveClass(
      rung.height, rung.radius, rung.text, rung.padX,
    );
    unmount();
  }
});

test('textarea rungs set a floor and evict the single-line height', () => {
  const { rerender } = render(<Textarea size="xs" aria-label="body"  value="" onChange={() => {}} />);
  const at = () => screen.getByLabelText('body');
  expect(at()).toHaveClass('h-auto', 'min-h-56');
  expect(at()).not.toHaveClass('h-28');
  rerender(<Textarea size="md" aria-label="body"  value="" onChange={() => {}} />);
  expect(at()).toHaveClass('h-auto', 'min-h-72');
  rerender(<Textarea size="lg" aria-label="body"  value="" onChange={() => {}} />);
  expect(at()).toHaveClass('h-auto', 'min-h-88');
});

test('a popup trigger rings on Tab but not on click; a text field rings on both', () => {
  // `21 Input Interactions`: "Triggers use :focus-visible — clicking one leaves
  // no ring, tabbing to it does. Text fields ring on click too, via
  // :focus-within, because a clicked text field genuinely holds the caret and
  // hiding that would be the bug."
  //
  // A trigger opens a popup; a ring left behind on it after the click points at
  // the trigger while the user is looking at the list.
  expect(fieldClass({ focus: 'focus-visible' })).toContain(
    focusRing('indigo', 'focus-visible'),
  );
  expect(fieldClass({ focus: 'focus-visible' })).not.toContain(focusRing('indigo', 'focus'));
  // The default stays `focus`, which is what a plain text field wants.
  expect(fieldClass()).toContain(focusRing('indigo', 'focus'));
});
