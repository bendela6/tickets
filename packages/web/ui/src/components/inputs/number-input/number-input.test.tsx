import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { NumberInput } from './number-input';

test('stepper increments and typing updates the value', async () => {
  const onChange = vi.fn();
  render(<NumberInput value={8} onChange={onChange} step={1} />);
  await userEvent.click(screen.getByRole('button', { name: /increment/i }));
  expect(onChange).toHaveBeenCalledWith(9);
});

test('clearing the field emits null', async () => {
  const onChange = vi.fn();
  render(<NumberInput value={8} onChange={onChange} />);
  await userEvent.clear(screen.getByRole('spinbutton'));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

test('the ref lands on the inner input, not the wrapper', () => {
  const ref = createRef<HTMLInputElement>();
  render(<NumberInput ref={ref} value={3} onChange={() => {}} />);
  // The node that takes focus is the one a caller reaching for a ref wants —
  // a wrapper <div> would be useless to `.focus()` and to `.select()`.
  expect(ref.current).toBe(screen.getByRole('spinbutton'));
  expect(ref.current?.tagName).toBe('INPUT');
});

test('read-only takes the real attribute and refuses typing', async () => {
  const onChange = vi.fn();
  render(<NumberInput value={8} onChange={onChange} readOnly />);
  const input = screen.getByRole('spinbutton');
  expect(input).toHaveAttribute('readonly');
  await userEvent.type(input, '9');
  expect(onChange).not.toHaveBeenCalled();
});

test('read-only neutralises the steppers', async () => {
  const onChange = vi.fn();
  render(<NumberInput value={8} onChange={onChange} readOnly />);
  await userEvent.click(screen.getByRole('button', { name: /increment/i }));
  await userEvent.click(screen.getByRole('button', { name: /decrement/i }));
  expect(onChange).not.toHaveBeenCalled();
  // Still showing the value it holds — read-only hides nothing.
  expect(screen.getByRole('spinbutton')).toHaveValue(8);
});

test('read-only stays focusable and is not disabled', async () => {
  render(<NumberInput value={8} onChange={() => {}} readOnly />);
  const input = screen.getByRole('spinbutton');
  // The distinction the contract turns on: a field locked by permission keeps
  // its tab stop and its place in form submission; `disabled` drops both.
  expect(input).not.toBeDisabled();
  await userEvent.tab();
  expect(input).toHaveFocus();
});

test('a null value renders an empty field rather than 0 or NaN', () => {
  const { rerender } = render(<NumberInput value={null} onChange={() => {}} />);
  const input = screen.getByRole('spinbutton') as HTMLInputElement;
  expect(input.value).toBe('');

  // …and it round-trips: a value in and back out again leaves the field empty
  // again, not sitting on the last number it held.
  rerender(<NumberInput value={7} onChange={() => {}} />);
  expect(input.value).toBe('7');
  rerender(<NumberInput value={null} onChange={() => {}} />);
  expect(input.value).toBe('');
});

test('stepping up from empty starts at zero rather than NaN', async () => {
  const onChange = vi.fn();
  render(<NumberInput value={null} onChange={onChange} step={5} />);
  await userEvent.click(screen.getByRole('button', { name: /increment/i }));
  expect(onChange).toHaveBeenCalledWith(5);
});

test('the stepper reaches the right edge, and the field fills its column', () => {
  // Two faults reported together and sharing a cause. `inline-flex` made the
  // control shrink to its content, so it sat narrower than every field above it
  // in the same form; and the ladder's horizontal padding applied to the
  // WRAPPER, holding the seam and the arrows 12px inside the field.
  const { container } = render(<NumberInput value={3} onChange={() => {}} />);
  const wrapper = container.firstElementChild!;

  expect(wrapper.className).toContain('w-full');
  expect(wrapper.className).not.toContain('inline-flex');
  // The right padding is given up so the stepper column can meet the edge.
  expect(wrapper.className).toContain('pr-0');
});

test('the value grows to fill, rather than sitting at a fixed width', () => {
  const { container } = render(<NumberInput value={3} onChange={() => {}} />);
  const input = container.querySelector('input')!;
  expect(input.className).toContain('flex-1');
  expect(input.className).not.toMatch(/\bw-64\b/);
});
