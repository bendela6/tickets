import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { DateRangePicker } from './date-range-picker';

const open = async () => userEvent.click(screen.getByRole('combobox'));
const day = (n: string) => screen.getByRole('button', { name: n });

test('the pending half is a placeholder, not blank', async () => {
  // "4 Aug →" with nothing after it looks broken; "4 Aug → end" is waiting.
  render(<DateRangePicker value={['2026-08-04T00:00:00Z', null]} onChange={() => {}} />);
  const trigger = screen.getByRole('combobox');
  expect(trigger).toHaveTextContent('4 Aug');
  expect(trigger).toHaveTextContent('end');
});

test('the two ends are joined by an arrow, never a hyphen', () => {
  // A hyphen between two dates reads as a subtraction or a typo; a range has a
  // direction.
  render(
    <DateRangePicker
      value={['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']}
      onChange={() => {}}
    />,
  );
  expect(screen.getByRole('combobox')).toHaveTextContent('→');
});

test('the first click sets a start and waits for the end', async () => {
  // This is the one case with no value to open on, so the calendar opens on
  // whatever month it is TODAY. Only `Date` is faked — the real timers stay,
  // because user-event schedules on them.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
  try {
    const onChange = vi.fn();
    render(<DateRangePicker value={[null, null]} onChange={onChange} />);
    await open();
    await userEvent.click(day('4'));
    expect(onChange).toHaveBeenCalledWith(['2026-08-04T00:00:00Z', null]);
  } finally {
    vi.useRealTimers();
  }
});

test('a second click closes the range', async () => {
  const onChange = vi.fn();
  render(<DateRangePicker value={['2026-08-04T00:00:00Z', null]} onChange={onChange} />);
  await open();
  await userEvent.click(day('18'));
  expect(onChange).toHaveBeenCalledWith(['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']);
});

test('picking backwards from the anchor still yields an ordered range', async () => {
  // Dragging left from the start is a legitimate way to pick a span; the value
  // must not come back reversed.
  const onChange = vi.fn();
  render(<DateRangePicker value={['2026-08-18T00:00:00Z', null]} onChange={onChange} />);
  await open();
  await userEvent.click(day('4'));
  expect(onChange).toHaveBeenCalledWith(['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']);
});

test('a third click starts over rather than narrowing', async () => {
  // Otherwise a range once set can only be adjusted from whichever end you
  // happen to click.
  const onChange = vi.fn();
  render(
    <DateRangePicker
      value={['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']}
      onChange={onChange}
    />,
  );
  await open();
  await userEvent.click(day('11'));
  expect(onChange).toHaveBeenCalledWith(['2026-08-11T00:00:00Z', null]);
});

test('hovering paints the span while the end is pending', async () => {
  render(<DateRangePicker value={['2026-08-04T00:00:00Z', null]} onChange={() => {}} />);
  await open();
  fireEvent.mouseEnter(day('10'));
  // A day inside the previewed span takes the rung-2 fill; one outside does not.
  expect(day('7').className).toMatch(/bg-indigo-2/);
  expect(day('20').className).not.toMatch(/bg-indigo-2/);
});

test('a settled range paints between its ends', async () => {
  render(
    <DateRangePicker
      value={['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']}
      onChange={() => {}}
    />,
  );
  await open();
  expect(day('11').className).toMatch(/bg-indigo-2/);
  expect(day('4').className).toMatch(/bg-indigo-9/);
  expect(day('18').className).toMatch(/bg-indigo-9/);
});

test('clear empties both halves at once', async () => {
  const onChange = vi.fn();
  render(
    <DateRangePicker
      value={['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']}
      onChange={onChange}
    />,
  );
  await open();
  await userEvent.click(screen.getByRole('button', { name: 'clear' }));
  expect(onChange).toHaveBeenCalledWith([null, null]);
});

test('read-only keeps the tab stop and refuses to open', async () => {
  render(<DateRangePicker value={['2026-08-04T00:00:00Z', null]} onChange={() => {}} readOnly />);
  const trigger = screen.getByRole('combobox');
  await userEvent.tab();
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  expect(screen.queryByRole('grid')).toBeNull();
});

test('takes an accessible name where no label points at it', () => {
  render(<DateRangePicker aria-label="Created" value={[null, null]} onChange={() => {}} />);
  expect(screen.getByRole('combobox', { name: 'Created' })).toBeInTheDocument();
});

const month = (name: string) => screen.getByRole('button', { name });

test('by month, the ends read as months and a pick holds one', async () => {
  const onChange = vi.fn();
  render(<DateRangePicker granularity="month" value={['2023-08', null]} onChange={onChange} />);
  expect(screen.getByRole('combobox')).toHaveTextContent('Aug 2023');
  await open();
  // A year of months, not a month of days.
  expect(screen.getByRole('grid', { name: '2023' })).toBeInTheDocument();
  await userEvent.click(month('November 2023'));
  expect(onChange).toHaveBeenCalledWith(['2023-08', '2023-11']);
});

test('by month, the arrows move a year, and a range may cross one', async () => {
  const onChange = vi.fn();
  render(<DateRangePicker granularity="month" value={['2023-08', null]} onChange={onChange} />);
  await open();
  await userEvent.click(screen.getByRole('button', { name: 'Next year' }));
  expect(screen.getByRole('grid', { name: '2024' })).toBeInTheDocument();
  await userEvent.click(month('March 2024'));
  expect(onChange).toHaveBeenCalledWith(['2023-08', '2024-03']);
});

test('an open end names a range that has not ended, instead of waiting for it', async () => {
  // "Aug 2023 → end" would say the control is waiting; this range is settled.
  const onChange = vi.fn();
  render(
    <DateRangePicker
      granularity="month"
      openEnd="Ongoing"
      value={['2023-08', null]}
      onChange={onChange}
    />,
  );
  const trigger = screen.getByRole('combobox');
  expect(trigger).toHaveTextContent('Aug 2023');
  expect(trigger).toHaveTextContent('Ongoing');
  expect(trigger).not.toHaveTextContent('end');
  // Settled, so the next pick starts over rather than closing it.
  await open();
  await userEvent.click(month('May 2023'));
  expect(onChange).toHaveBeenLastCalledWith(['2023-05', null]);
});

test('an open end is offered in the popup, and ends a pick there', async () => {
  const onChange = vi.fn();
  render(
    <DateRangePicker
      granularity="month"
      openEnd="Ongoing"
      value={['2023-08', '2024-05']}
      onChange={onChange}
    />,
  );
  await open();
  await userEvent.click(screen.getByRole('button', { name: 'Ongoing' }));
  expect(onChange).toHaveBeenCalledWith(['2023-08', null]);
});
