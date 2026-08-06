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
    <DateRangePicker value={['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']} onChange={() => {}} />,
  );
  expect(screen.getByRole('combobox')).toHaveTextContent('→');
});

test('the first click sets a start and waits for the end', async () => {
  const onChange = vi.fn();
  render(<DateRangePicker value={[null, null]} onChange={onChange} />);
  await open();
  await userEvent.click(day('4'));
  expect(onChange).toHaveBeenCalledWith(['2026-08-04T00:00:00Z', null]);
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
    <DateRangePicker value={['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']} onChange={onChange} />,
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
    <DateRangePicker value={['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']} onChange={() => {}} />,
  );
  await open();
  expect(day('11').className).toMatch(/bg-indigo-2/);
  expect(day('4').className).toMatch(/bg-indigo-9/);
  expect(day('18').className).toMatch(/bg-indigo-9/);
});

test('clear empties both halves at once', async () => {
  const onChange = vi.fn();
  render(
    <DateRangePicker value={['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']} onChange={onChange} />,
  );
  await open();
  await userEvent.click(screen.getByRole('button', { name: 'clear' }));
  expect(onChange).toHaveBeenCalledWith([null, null]);
});

test('read-only keeps the tab stop and refuses to open', async () => {
  render(
    <DateRangePicker value={['2026-08-04T00:00:00Z', null]} onChange={() => {}} readOnly />,
  );
  const trigger = screen.getByRole('combobox');
  await userEvent.tab();
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  expect(screen.queryByRole('grid')).toBeNull();
});
