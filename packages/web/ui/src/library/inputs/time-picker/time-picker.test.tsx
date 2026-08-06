import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, test, vi } from 'vitest';
import { TimePicker, formatTime, parseTime } from './time-picker';

describe('parseTime', () => {
  it('reads a time of day', () => {
    expect(parseTime('14:30')).toBe(870);
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('9:05')).toBe(545);
  });

  it('rejects digits that are not a time', () => {
    // The design's example: 25:99 matches the shape and is not a time. Storing
    // it would keep a number no clock can show.
    expect(parseTime('25:99')).toBeNull();
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('half two')).toBeNull();
  });
});

describe('formatTime', () => {
  it('zero-pads both halves so a column aligns', () => {
    expect(formatTime(870)).toBe('14:30');
    expect(formatTime(5)).toBe('00:05');
  });
});

const open = async () => userEvent.click(screen.getByRole('combobox'));

test('the offered times follow the step', async () => {
  render(<TimePicker value={null} onChange={() => {}} stepMinutes={60} />);
  await open();
  expect(screen.getAllByRole('option')).toHaveLength(24);
});

test('picking a listed time commits it as HH:MM', async () => {
  const onChange = vi.fn();
  render(<TimePicker value={null} onChange={onChange} stepMinutes={60} />);
  await open();
  await userEvent.click(screen.getByRole('option', { name: '14:00' }));
  expect(onChange).toHaveBeenCalledWith('14:00');
});

test('a typed time is accepted even when it is not on the list', async () => {
  // A 15-minute list is 96 rows, and the one time you want is reliably the one
  // that is not on it.
  const onChange = vi.fn();
  render(<TimePicker value={null} onChange={onChange} stepMinutes={60} />);
  await open();
  await userEvent.type(screen.getByLabelText('Enter a time'), '14:37{Enter}');
  expect(onChange).toHaveBeenCalledWith('14:37');
});

test('an unparseable entry is refused and says why', async () => {
  const onChange = vi.fn();
  render(<TimePicker value={null} onChange={onChange} />);
  await open();
  await userEvent.type(screen.getByLabelText('Enter a time'), '25:99{Enter}');
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Not a time of day');
});

test('the trigger is monospace, and the placeholder is not', () => {
  // Every time in the system is mono so a column aligns on its digits; the
  // placeholder is prose, and setting it in mono would read as a value.
  const { rerender } = render(<TimePicker value="14:30" onChange={() => {}} />);
  expect(screen.getByText('14:30').className).toContain('font-mono');

  rerender(<TimePicker value={null} onChange={() => {}} placeholder="No time" />);
  expect(screen.getByText('No time').className).not.toContain('font-mono');
});

test('read-only keeps the tab stop and refuses to open', async () => {
  render(<TimePicker value="14:30" onChange={() => {}} readOnly />);
  const trigger = screen.getByRole('combobox');
  await userEvent.tab();
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(trigger).not.toBeDisabled();
});
