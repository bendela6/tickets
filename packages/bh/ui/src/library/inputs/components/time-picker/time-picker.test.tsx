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

describe('the cursor', () => {
  const field = () => screen.getByLabelText('Enter a time');
  /** The listed time the time field points at, by its accessible name. */
  const cursorOn = (time: string) => {
    expect(field()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: time }).id,
    );
  };

  it('opens on the chosen time', async () => {
    render(<TimePicker value="14:00" onChange={() => {}} stepMinutes={60} />);
    await open();
    cursorOn('14:00');
  });

  it('moves with the arrows, writes its time into the field, and Enter picks it', async () => {
    const onChange = vi.fn();
    render(<TimePicker value="14:00" onChange={onChange} stepMinutes={60} />);
    await open();
    await userEvent.keyboard('{ArrowDown}');
    cursorOn('15:00');
    expect(field()).toHaveValue('15:00');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    cursorOn('13:00');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('13:00');
  });

  it('is not the selection: the chosen time keeps aria-selected while it moves', async () => {
    render(<TimePicker value="14:00" onChange={() => {}} stepMinutes={60} />);
    await open();
    await userEvent.keyboard('{ArrowDown}');
    cursorOn('15:00');
    expect(screen.getByRole('option', { name: '14:00' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: '15:00' })).toHaveAttribute('aria-selected', 'false');
  });

  it('goes to the first and last time with Home and End', async () => {
    render(<TimePicker value="14:00" onChange={() => {}} stepMinutes={60} />);
    await open();
    await userEvent.keyboard('{End}');
    cursorOn('23:00');
    await userEvent.keyboard('{Home}');
    cursorOn('00:00');
  });

  it('starts from either end of the list when the field holds no time', async () => {
    render(<TimePicker value={null} onChange={() => {}} stepMinutes={60} />);
    await open();
    expect(field()).not.toHaveAttribute('aria-activedescendant');
    await userEvent.keyboard('{ArrowDown}');
    cursorOn('00:00');
    await userEvent.clear(field());
    await userEvent.keyboard('{ArrowUp}');
    cursorOn('23:00');
  });

  it('follows a typed time, and steps from one typed between two rows', async () => {
    render(<TimePicker value={null} onChange={() => {}} stepMinutes={60} />);
    await open();
    await userEvent.type(field(), '9:00');
    cursorOn('09:00');
    // 09:20 is on no row, so no row is under the cursor until a key moves it.
    await userEvent.clear(field());
    await userEvent.type(field(), '09:20');
    expect(field()).not.toHaveAttribute('aria-activedescendant');
    await userEvent.keyboard('{ArrowDown}');
    cursorOn('10:00');
    await userEvent.clear(field());
    await userEvent.type(field(), '09:20{ArrowUp}');
    cursorOn('09:00');
  });
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

test('takes an aria-label, for a field with no visible label to point at it', () => {
  // `label` names the list of times; `aria-label` names the field itself.
  render(<TimePicker value="09:30" onChange={() => {}} aria-label="Starts at" />);
  expect(screen.getByRole('combobox', { name: 'Starts at' })).toHaveTextContent('09:30');
});
