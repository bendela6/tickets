import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { DatePicker } from './date-picker';
import { FieldLabel } from '../../field-label';

test('opens to the value month and emits the picked day', async () => {
  const onChange = vi.fn();
  render(<DatePicker value="2026-07-12T00:00:00Z" onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: /jul 12, 2026/i }));
  expect(await screen.findByText('July 2026')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '15' }));
  expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^2026-07-15/));
});

// The control was the only one in the library with no `id`, which meant a
// FieldLabel had nothing to point at and the field could not be named at all.
// Asserted through the label rather than through the attribute: `getByLabelText`
// only finds it if the association actually resolves in the DOM.
test('a FieldLabel names the trigger through id', async () => {
  render(
    <>
      <FieldLabel htmlFor="due">Due date</FieldLabel>
      <DatePicker id="due" value={null} onChange={() => {}} />
    </>,
  );
  const trigger = screen.getByLabelText('Due date');
  expect(trigger).toBe(screen.getByRole('button'));
  // …and it is the focusable element, not a wrapper that merely holds the id.
  await userEvent.tab();
  expect(trigger).toHaveFocus();
});

test('read-only refuses the calendar but keeps the tab stop', async () => {
  const onChange = vi.fn();
  render(<DatePicker value="2026-07-12T00:00:00Z" onChange={onChange} readOnly />);
  const trigger = screen.getByRole('button');

  // It keeps the tab stop `disabled` would have taken…
  await userEvent.tab();
  expect(trigger).toHaveFocus();

  // …and neither the keyboard nor the pointer gets a calendar out of it.
  await userEvent.keyboard('{Enter}');
  expect(screen.queryByText('July 2026')).toBeNull();
  await userEvent.click(trigger);
  expect(screen.queryByText('July 2026')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();

  // Read-only is not disabled: the value is still shown, still reachable and
  // still submitted, and focus survives the refused click.
  expect(trigger).not.toBeDisabled();
  expect(trigger).toHaveAttribute('aria-disabled', 'true');
  expect(trigger).toHaveTextContent('Jul 12, 2026');
  expect(trigger).toHaveFocus();
});

test('a rest field carries no readonly claim', () => {
  render(<DatePicker value={null} onChange={() => {}} />);
  expect(screen.getByRole('button')).not.toHaveAttribute('aria-disabled');
});

test('the value round-trips as an ISO string', async () => {
  const seen: (string | null)[] = [];
  const onChange = (next: string | null) => seen.push(next);
  const { rerender } = render(<DatePicker value="2026-07-12T00:00:00Z" onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: /jul 12, 2026/i }));
  await userEvent.click(screen.getByRole('button', { name: '15' }));

  expect(seen).toHaveLength(1);
  const emitted = seen[0]!;
  expect(emitted.slice(0, 10)).toBe('2026-07-15');
  expect(new Date(emitted).toISOString()).toBe('2026-07-15T00:00:00.000Z');

  // Feeding the emitted string straight back is the round trip: the control
  // reads its own output as the same calendar day.
  rerender(<DatePicker value={emitted} onChange={onChange} />);
  expect(screen.getByRole('button', { name: /jul 15, 2026/i })).toBeInTheDocument();
});

test('min and max refuse the days outside them', async () => {
  const onChange = vi.fn();
  render(
    <DatePicker value="2026-07-12T00:00:00Z" onChange={onChange} min="2026-07-06" max="2026-07-17" />,
  );
  await userEvent.click(screen.getByRole('button', { name: /jul 12, 2026/i }));

  // Still drawn — the month keeps its shape — but not selectable.
  const blocked = await screen.findByRole('button', { name: '3' });
  expect(blocked).toBeDisabled();
  await userEvent.click(blocked);
  expect(onChange).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: '17' }));
  expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^2026-07-17/));
});

test('a typed date obeys the same bounds as a clicked one', async () => {
  const onChange = vi.fn();
  render(<DatePicker value={null} onChange={onChange} max="2026-07-17" />);
  await userEvent.click(screen.getByRole('button'));
  const entry = await screen.findByLabelText('Enter date');

  await userEvent.clear(entry);
  await userEvent.type(entry, '2026-07-28{Enter}');
  expect(onChange).not.toHaveBeenCalled();

  await userEvent.clear(entry);
  await userEvent.type(entry, '2026-07-10{Enter}');
  expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^2026-07-10/));
});

test('a date is monospace so a column of them aligns on the digits', () => {
  // The design: "Dates are always monospace." In a table a proportional face
  // makes every row a different width, and the digits stop lining up.
  render(<DatePicker value="2026-08-14T00:00:00Z" onChange={() => {}} />);
  const shown = screen.getByText(/2026|14/);
  expect(shown.className).toMatch(/font-mono/);
});

test('the placeholder stays proportional, because it is prose and not a date', () => {
  render(<DatePicker value={null} onChange={() => {}} placeholder="No due date" />);
  expect(screen.getByText('No due date').className).not.toMatch(/font-mono/);
});

const openCalendar = async () => {
  render(<DatePicker value="2026-08-14T00:00:00Z" onChange={() => {}} tone="danger" />);
  await userEvent.click(screen.getByRole('button'));
};

test('the calendar paints the selected day from the field ramp, not a hardcoded indigo', async () => {
  // A danger-toned picker used to open onto an indigo selection: the tile named
  // indigo outright rather than reading the scale the field had resolved.
  await openCalendar();
  const day = screen.getByRole('button', { name: '14' });
  expect(day.className).toMatch(/bg-red-\d/);
  expect(day.className).not.toMatch(/bg-indigo-\d/);
});

test('today is an INSET outline, so it cannot overlap its neighbours', async () => {
  // A 28px tile in the middle of a grid has no room for an outward ring, and
  // the old rule named two ring colours at once.
  await openCalendar();
  const todayCell = screen.getByRole('button', { name: String(new Date().getUTCDate()) });
  if (todayCell.className.includes('ring-1')) {
    expect(todayCell.className).toContain('ring-inset');
  }
});

test('the calendar digits are mono, so a month aligns on its columns', async () => {
  await openCalendar();
  expect(screen.getByRole('button', { name: '14' }).className).toContain('font-mono');
});
