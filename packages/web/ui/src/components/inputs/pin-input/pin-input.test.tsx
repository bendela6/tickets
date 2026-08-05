import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { PinInput } from './pin-input';

const cells = () => screen.getAllByRole('textbox');

test('the cells are one value, not six', async () => {
  // Six independent fields would leave the caller reassembling them.
  const onChange = vi.fn();
  render(<PinInput value="" onChange={onChange} length={6} />);
  expect(cells()).toHaveLength(6);
  await userEvent.type(cells()[0]!, '4');
  expect(onChange).toHaveBeenCalledWith('4');
});

test('typing advances, and a full paste fills every cell', async () => {
  // Pasting is how most codes are actually entered; without this the whole code
  // lands in cell one and is truncated to a single character.
  const onChange = vi.fn();
  render(<PinInput value="" onChange={onChange} length={6} />);
  await userEvent.click(cells()[0]!);
  await userEvent.paste('429117');
  expect(onChange).toHaveBeenCalledWith('429117');
});

test('backspace on an empty cell steps back and clears the one before', async () => {
  // A run of backspaces should walk the code rather than stall on the blank.
  const onChange = vi.fn();
  render(<PinInput value="429" onChange={onChange} length={6} />);
  await userEvent.click(cells()[3]!);
  await userEvent.keyboard('{Backspace}');
  expect(onChange).toHaveBeenCalledWith('42');
});

test('a half-entered code carries no padding', async () => {
  // "429" rather than "429   ", or an incomplete code looks complete to a
  // caller comparing lengths.
  const onChange = vi.fn();
  render(<PinInput value="42" onChange={onChange} length={6} />);
  await userEvent.type(cells()[2]!, '9');
  expect(onChange).toHaveBeenCalledWith('429');
});

test('arrows move between cells without changing anything', async () => {
  const onChange = vi.fn();
  render(<PinInput value="429" onChange={onChange} length={6} />);
  await userEvent.click(cells()[2]!);
  await userEvent.keyboard('{ArrowLeft}{ArrowRight}');
  expect(onChange).not.toHaveBeenCalled();
});

test('tone danger is what marks a rejected code', () => {
  render(<PinInput value="429117" onChange={() => {}} tone="danger" />);
  expect(screen.getByRole('group')).toHaveAttribute('aria-invalid', 'true');
});

test('read-only refuses input but keeps the cells reachable', async () => {
  const onChange = vi.fn();
  render(<PinInput value="429" onChange={onChange} readOnly />);
  await userEvent.type(cells()[3]!, '1');
  expect(onChange).not.toHaveBeenCalled();
  expect(cells()[0]!).not.toBeDisabled();
});
