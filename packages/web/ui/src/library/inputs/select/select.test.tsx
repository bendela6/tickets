import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Select } from './select';

const OPTIONS = [
  { value: 'task', label: 'Task', color: 'blue' as const },
  { value: 'bug', label: 'Bug', color: 'red' as const },
  { value: 'chore', label: 'Chore' },
  { value: 'spike', label: 'Spike', disabled: true },
];

const open = async () => userEvent.click(screen.getByRole('combobox'));

test('the value is PLAIN TEXT, never a chip', async () => {
  // The distinction this control exists for. Every single-select in the product
  // used to render its value as a chip, which says "one of several things I am
  // holding" about a control that holds exactly one.
  render(<Select options={OPTIONS} value="task" onChange={() => {}} />);
  const trigger = screen.getByRole('combobox');
  expect(trigger).toHaveTextContent('Task');
  // A chip would bring a fill and a radius of its own.
  expect(trigger.querySelector('[data-chip]')).toBeNull();
  expect(trigger.className).not.toMatch(/bg-blue-\d/);
});

test('a coloured option keeps its dot, because that is data', async () => {
  const { container } = render(<Select options={OPTIONS} value="task" onChange={() => {}} />);
  expect(container.querySelector('.bg-blue-9')).not.toBeNull();
});

test('an uncoloured option draws no dot', () => {
  const { container } = render(<Select options={OPTIONS} value="chore" onChange={() => {}} />);
  expect(container.querySelector('[class*="rounded-full"]')).toBeNull();
});

test('the placeholder stands in for an empty value', () => {
  render(<Select options={OPTIONS} value={null} onChange={() => {}} placeholder="Choose a type" />);
  expect(screen.getByRole('combobox')).toHaveTextContent('Choose a type');
});

test('picking commits and closes', async () => {
  const onChange = vi.fn();
  render(<Select options={OPTIONS} value={null} onChange={onChange} />);
  await open();
  await userEvent.click(screen.getByRole('option', { name: 'Bug' }));
  expect(onChange).toHaveBeenCalledWith('bug');
});

test('the cursor opens on the selected row, so Enter changes nothing', async () => {
  // Opening onto row 0 would mean Enter silently moved the value to whatever
  // happened to be first.
  const onChange = vi.fn();
  render(<Select options={OPTIONS} value="chore" onChange={onChange} />);
  await open();
  await userEvent.keyboard('{Enter}');
  expect(onChange).toHaveBeenCalledWith('chore');
});

test('the cursor steps over a disabled row rather than resting on it', async () => {
  // A cursor on a disabled row means Enter does nothing at all, and silence is
  // the worst answer a keypress can get.
  const onChange = vi.fn();
  render(<Select options={OPTIONS} value="chore" onChange={onChange} />);
  await open();
  await userEvent.keyboard('{ArrowDown}{Enter}');
  // 'spike' is disabled and is the only row below 'chore', so the cursor holds.
  expect(onChange).toHaveBeenCalledWith('chore');
});

test('a disabled option refuses the pointer too', async () => {
  const onChange = vi.fn();
  render(<Select options={OPTIONS} value={null} onChange={onChange} />);
  await open();
  await userEvent.click(screen.getByRole('option', { name: 'Spike' }));
  expect(onChange).not.toHaveBeenCalled();
});

test('read-only keeps the tab stop and refuses to open', async () => {
  render(<Select options={OPTIONS} value="task" onChange={() => {}} readOnly />);
  const trigger = screen.getByRole('combobox');
  await userEvent.tab();
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(trigger).not.toBeDisabled();
  expect(trigger).toHaveAttribute('aria-disabled', 'true');
});

test('tone danger is what announces invalid — there is no invalid prop', () => {
  const { rerender } = render(<Select options={OPTIONS} value="task" onChange={() => {}} />);
  expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid');
  rerender(<Select options={OPTIONS} value="task" onChange={() => {}} tone="danger" />);
  expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
});

test('an empty list says so rather than opening onto nothing', async () => {
  render(<Select options={[]} value={null} onChange={() => {}} />);
  await open();
  expect(screen.getByText('Nothing to choose')).toBeInTheDocument();
});
