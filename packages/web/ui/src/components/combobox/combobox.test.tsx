import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Combobox } from './combobox';

const OPTIONS = [
  { value: 'p0', label: 'P0 · critical', color: 'red' as const },
  { value: 'p1', label: 'P1 · high', color: 'orange' as const },
  { value: 'p2', label: 'P2 · normal', color: 'gray' as const },
];

test('opens, filters by search, and selects an option', async () => {
  const onChange = vi.fn();
  render(<Combobox options={OPTIONS} value={null} onChange={onChange} placeholder="Priority" />);
  await userEvent.click(screen.getByRole('button', { name: /priority/i }));
  const search = await screen.findByRole('combobox');
  await userEvent.type(search, 'high');
  // only P1 · high remains after filtering
  expect(screen.queryByRole('option', { name: /P0/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('option', { name: /P1/ }));
  expect(onChange).toHaveBeenCalledWith('p1');
});

test('shows the selected label on the trigger', () => {
  render(<Combobox options={OPTIONS} value="p0" onChange={() => {}} placeholder="Priority" />);
  expect(screen.getByRole('button')).toHaveTextContent('P0 · critical');
});

test('searchable={false} drops the search box but still lists every option', async () => {
  render(<Combobox options={OPTIONS} value={null} onChange={() => {}} searchable={false} />);
  await userEvent.click(screen.getByRole('button'));
  expect(await screen.findAllByRole('option')).toHaveLength(3);
  // The trigger keeps role=button; only the list's own search input was a
  // combobox, so its absence is what proves the box is gone.
  expect(screen.queryByRole('combobox')).toBeNull();
});

test('searchable={false} keeps the keyboard model the search box used to own', async () => {
  // The input carried autoFocus, onKeyDown and aria-activedescendant. Removing
  // it must not strand focus on the trigger, or arrows would scroll the page
  // instead of moving the selection.
  const onChange = vi.fn();
  render(<Combobox options={OPTIONS} value={null} onChange={onChange} searchable={false} />);
  await userEvent.click(screen.getByRole('button'));
  const list = await screen.findByRole('listbox');
  expect(list).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}{Enter}');
  expect(onChange).toHaveBeenCalledWith('p1');
});

test('has no clear affordance — a single select is changed by picking, not emptied', () => {
  // The X sat in the trigger competing with the chevron for the same corner,
  // and a required single-select had no legal empty state to clear to.
  // MultiCombobox keeps one, where clearing several chips is the real gesture.
  render(<Combobox options={OPTIONS} value="p0" onChange={() => {}} />);
  expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
});
