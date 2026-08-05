import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Switch } from './switch';

/** The switch is controlled, so anything that asserts a toggle needs an owner. */
function Controlled({ initial = false }: { initial?: boolean }) {
  const [value, setValue] = useState(initial);
  return <Switch label="KPI strip" value={value} onChange={setValue} />;
}

test('toggles checked state', async () => {
  render(<Controlled />);
  const control = screen.getByRole('switch', { name: 'KPI strip' });
  expect(control).not.toBeChecked();
  await userEvent.click(control);
  expect(control).toBeChecked();
});

test('label text toggles the switch', async () => {
  render(<Controlled />);
  await userEvent.click(screen.getByText('KPI strip'));
  expect(screen.getByRole('switch', { name: 'KPI strip' })).toBeChecked();
});

test('reflects the value it is given rather than its own DOM state', async () => {
  // Frozen at false: clicking a controlled switch whose owner ignores the
  // change must leave it off. This is what taking `value` buys over `checked`.
  render(<Switch label="KPI strip" value={false} onChange={() => {}} />);
  const control = screen.getByRole('switch', { name: 'KPI strip' });
  await userEvent.click(control);
  expect(control).not.toBeChecked();
});

test('onChange receives the boolean, not the DOM event', async () => {
  const onChange = vi.fn();
  render(<Switch label="KPI strip" value={false} onChange={onChange} />);
  await userEvent.click(screen.getByRole('switch', { name: 'KPI strip' }));
  // Two facts: the VALUE arrives first, so no caller reaches into `.target` —
  // and the event rides second for the few call sites that need the modifier
  // keys. Asserted positionally rather than with toHaveBeenCalledWith, which
  // would be satisfied by the value alone and hide the second argument.
  expect(onChange).toHaveBeenCalledTimes(1);
  const [next, event] = onChange.mock.calls[0]!;
  expect(next).toBe(true);
  expect(event).toHaveProperty('target');
});

test('onChange reports false when switching off', async () => {
  const onChange = vi.fn();
  render(<Switch label="KPI strip" value onChange={onChange} />);
  await userEvent.click(screen.getByRole('switch', { name: 'KPI strip' }));
  expect(onChange.mock.calls[0]![0]).toBe(false);
});

test('read-only refuses to emit but keeps its tab stop', async () => {
  const onChange = vi.fn();
  render(<Switch label="KPI strip" value onChange={onChange} readOnly />);
  const control = screen.getByRole('switch', { name: 'KPI strip' });

  expect(control).toHaveAttribute('aria-readonly', 'true');
  // Read-only is not disabled: the value still reads and still submits.
  expect(control).not.toBeDisabled();
  expect(control).toBeChecked();

  await userEvent.tab();
  expect(control).toHaveFocus();

  // fireEvent rather than userEvent: the row carries `pointer-events-none`, so
  // a real pointer never reaches the input. This drives the paths that DO reach
  // it — a forwarded activation and the space key — and proves the refusal.
  fireEvent.click(control);
  await userEvent.keyboard(' ');
  expect(onChange).not.toHaveBeenCalled();
  expect(control).toBeChecked();
});

test('read-only sets no aria-readonly when off', () => {
  render(<Switch label="KPI strip" value={false} onChange={() => {}} />);
  expect(screen.getByRole('switch', { name: 'KPI strip' })).not.toHaveAttribute('aria-readonly');
});

test('disabled leaves the tab order', async () => {
  const onChange = vi.fn();
  render(<Switch label="KPI strip" value={false} onChange={onChange} disabled />);
  const control = screen.getByRole('switch', { name: 'KPI strip' });
  expect(control).toBeDisabled();
  await userEvent.tab();
  expect(control).not.toHaveFocus();
});

test('renders nothing in place of an omitted label', () => {
  render(<Switch id="alerts" value={false} onChange={() => {}} />);
  expect(screen.getByRole('switch')).not.toHaveAccessibleName();
  expect(screen.queryAllByText(/\S/)).toHaveLength(0);
});

test('an omitted label leaves the switch nameable from outside', () => {
  render(
    <>
      <label htmlFor="alerts">Email alerts</label>
      <Switch id="alerts" value={false} onChange={() => {}} />
    </>,
  );
  expect(screen.getByRole('switch', { name: 'Email alerts' })).toBeInTheDocument();
});

test('passes native attributes through', () => {
  render(<Switch label="KPI strip" name="kpi" value={false} onChange={() => {}} />);
  expect(screen.getByRole('switch', { name: 'KPI strip' })).toHaveAttribute('name', 'kpi');
});
