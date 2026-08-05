import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { CONTROL_LADDER } from '../field';
import { Textarea } from './textarea';

function Controlled({ initial = '', ...props }: { initial?: string } & Record<string, unknown>) {
  const [value, setValue] = useState(initial);
  return <Textarea value={value} onChange={setValue} aria-label="Notes" {...props} />;
}

test('onChange hands over the value, not the DOM event', async () => {
  const onChange = vi.fn();
  render(<Textarea value="" onChange={onChange} aria-label="Notes" />);

  await userEvent.type(screen.getByLabelText('Notes'), 'a');

  // The whole point of ControlProps<string>: `onChange={setNotes}` has to be a
  // legal call site. Passing the SyntheticEvent through would type-check at the
  // component and store an event object in the caller's state.
  expect(onChange).toHaveBeenCalledWith('a');
  expect(typeof onChange.mock.calls[0]![0]).toBe('string');
});

test('the value round-trips through a caller that just holds a string', async () => {
  render(<Controlled />);
  const box = screen.getByLabelText('Notes');

  await userEvent.type(box, 'ship it');

  expect(box).toHaveValue('ship it');
});

test('readOnly sets the real HTML attribute', () => {
  // A <textarea> is one of the elements HTML's `readonly` actually reaches, so
  // the attribute — not aria-readonly — is what carries the behaviour here.
  render(<Textarea value="locked" onChange={() => {}} readOnly aria-label="Notes" />);
  const box = screen.getByLabelText('Notes') as HTMLTextAreaElement;

  expect(box).toHaveAttribute('readonly');
  expect(box.readOnly).toBe(true);
  expect(box).not.toHaveAttribute('aria-readonly');
});

test('readOnly also changes how the field looks', () => {
  // The attribute alone leaves the field identical to an editable one. The
  // ground goes inset, the border drops to the resting rung and stops
  // answering to hover, and the cursor stops inviting a click.
  render(<Textarea value="locked" onChange={() => {}} readOnly aria-label="Notes" />);
  const box = screen.getByLabelText('Notes');

  expect(box).toHaveClass('bg-transparent', 'border-gray-7', 'cursor-default');
  expect(box.className).toContain('hover:bg-transparent');
  // twMerge has to have evicted the editable treatment, not stacked on top of it.
  expect(box).not.toHaveClass('bg-gray-4');
  expect(box).not.toHaveClass('bg-gray-4', 'border-transparent');
  expect(box.className).not.toContain('hover:border-gray-9');
});

test('an editable field carries none of the read-only treatment', () => {
  render(<Textarea value="" onChange={() => {}} aria-label="Notes" />);
  const box = screen.getByLabelText('Notes');

  expect(box).not.toHaveAttribute('readonly');
  expect(box).toHaveClass('bg-gray-4', 'border-transparent');
  expect(box).not.toHaveClass('cursor-default');
});

test('a read-only field is still focusable and still holds its value, but emits nothing', async () => {
  const onChange = vi.fn();
  render(<Textarea value="locked" onChange={onChange} readOnly aria-label="Notes" />);
  const box = screen.getByLabelText('Notes');

  await userEvent.type(box, 'x');

  expect(box).toHaveFocus();
  expect(box).toHaveValue('locked');
  expect(onChange).not.toHaveBeenCalled();
});

test('disabled and readOnly are two different states, not two names for one', () => {
  render(
    <>
      <Textarea value="off" onChange={() => {}} disabled aria-label="Disabled" />
      <Textarea value="locked" onChange={() => {}} readOnly aria-label="Locked" />
    </>,
  );
  const off = screen.getByLabelText('Disabled') as HTMLTextAreaElement;
  const locked = screen.getByLabelText('Locked') as HTMLTextAreaElement;

  // Behaviour: only one of them leaves the tab order and drops out of submission.
  expect(off).toBeDisabled();
  expect(off.readOnly).toBe(false);
  expect(locked).not.toBeDisabled();
  expect(locked.readOnly).toBe(true);

  off.focus();
  expect(off).not.toHaveFocus();
  locked.focus();
  expect(locked).toHaveFocus();

  // Looks: disabled dims the text and swaps the ground behind the `disabled:`
  // variant; read-only swaps the ground unconditionally and keeps full text
  // contrast, because the value still matters.
  expect(off.className).toContain('disabled:text-gray-9');
  expect(off).not.toHaveClass('bg-transparent');
  expect(off).not.toHaveClass('cursor-default');
  expect(locked).toHaveClass('bg-transparent', 'text-gray-12');
});

test('read-only drops a toned border to the resting rung but keeps the invalid claim', () => {
  render(<Textarea value="x" onChange={() => {}} tone="danger" readOnly aria-label="Key" />);
  const box = screen.getByLabelText('Key');

  expect(box).toHaveAttribute('aria-invalid', 'true');
  expect(box).toHaveClass('border-gray-7', 'bg-transparent');
  expect(box).not.toHaveClass('bg-red-2');
});

test('an unset tone is the resting field, not primary', () => {
  render(<Textarea value="" onChange={() => {}} aria-label="Notes" />);
  const box = screen.getByLabelText('Notes');

  expect(box).toHaveClass('bg-gray-4', 'border-transparent');
  expect(box).not.toHaveClass('border-indigo-9');
  expect(box).not.toHaveAttribute('aria-invalid');
});

test('a toned field wears the ramp, and only danger claims invalid', () => {
  render(
    <>
      <Textarea value="" onChange={() => {}} tone="danger" aria-label="Bad" />
      <Textarea value="" onChange={() => {}} tone="success" aria-label="Good" />
    </>,
  );

  expect(screen.getByLabelText('Bad')).toHaveClass('bg-red-2');
  expect(screen.getByLabelText('Bad')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Good')).not.toHaveAttribute('aria-invalid');
});

test('each size rung evicts the single-line height and sets its own floor', () => {
  // `fieldClass` contributes a fixed `h-*` for the one-line controls. A
  // textarea grows, so every rung has to clear it before setting a min-height —
  // without the `h-auto` the box is pinned to the ladder's height and never
  // grows. The FONT comes from the ladder, not from the textarea's own map:
  // restating it there would win the twMerge and pin the old scale.
  const rungs = [
    { size: 'xs', min: 'min-h-56' },
    { size: 'md', min: 'min-h-72' },
    { size: 'lg', min: 'min-h-88' },
  ] as const;

  for (const { size, min } of rungs) {
    const { unmount } = render(
      <Textarea value="" onChange={() => {}} size={size} aria-label={size} />,
    );
    const box = screen.getByLabelText(size);
    expect(box).toHaveClass('h-auto', min, CONTROL_LADDER[size].text, 'resize-y');
    expect(box.className).not.toContain(CONTROL_LADDER[size].height);
    unmount();
  }
});

test('native textarea attributes still pass through', () => {
  render(
    <Textarea value="" onChange={() => {}} aria-label="Notes" name="body" rows={6} maxLength={280} />,
  );
  const box = screen.getByLabelText('Notes');

  expect(box).toHaveAttribute('name', 'body');
  expect(box).toHaveAttribute('rows', '6');
  expect(box).toHaveAttribute('maxlength', '280');
});

test('a locked textarea keeps no resize grip', () => {
  // The handle promises an edit. On a disabled or read-only box, dragging it
  // changes the one thing you are still allowed to change, which reads as the
  // control half-working rather than as locked.
  const { rerender } = render(<Textarea value="x" onChange={() => {}} aria-label="a" disabled />);
  expect(screen.getByLabelText('a').className).toContain('resize-none');

  rerender(<Textarea value="x" onChange={() => {}} aria-label="a" readOnly />);
  expect(screen.getByLabelText('a').className).toContain('resize-none');

  rerender(<Textarea value="x" onChange={() => {}} aria-label="a" />);
  expect(screen.getByLabelText('a').className).toContain('resize-y');
});
