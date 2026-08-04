import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Combobox } from './combobox';
import type { Option } from '../control';

const OPTIONS: Option[] = [
  { value: 'p0', label: 'P0 · critical', color: 'red' },
  { value: 'p1', label: 'P1 · high', color: 'orange' },
  { value: 'p2', label: 'P2 · normal', color: 'gray' },
];

const LONG_LABEL = 'Platform · ingestion · deduplicate inbound webhook payloads before fan-out';

/** Class tokens, not a substring match: `border-gray-7` is a substring of
 *  `focus:border-gray-7`, and the two say different things. */
function classes(element: HTMLElement): string[] {
  return element.className.split(/\s+/);
}

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

test('read-only refuses to open the list, by pointer or by key', async () => {
  const onChange = vi.fn();
  render(<Combobox options={OPTIONS} value="p0" onChange={onChange} readOnly />);
  const trigger = screen.getByRole('button');

  await userEvent.click(trigger);
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.queryByRole('option')).toBeNull();

  // The keyboard path is separate machinery in radix — Enter and Space on the
  // trigger open the popover without ever firing a click.
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard(' ');
  expect(screen.queryByRole('listbox')).toBeNull();

  // With no list there is nothing that can pick, so nothing can emit.
  expect(onChange).not.toHaveBeenCalled();
  expect(trigger).toHaveAttribute('aria-readonly', 'true');
});

test('read-only stays focusable and is NOT disabled', async () => {
  // The whole distinction: `disabled` would drop the tab stop and drop the
  // value from form submission, and a field locked by permission still owes
  // both. So the trigger keeps its tab stop and keeps rendering its value.
  render(<Combobox options={OPTIONS} value="p0" onChange={() => {}} readOnly />);
  const trigger = screen.getByRole('button');

  expect(trigger).not.toBeDisabled();
  expect(trigger).not.toHaveAttribute('disabled');
  expect(trigger).toHaveTextContent('P0 · critical');

  await userEvent.tab();
  expect(trigger).toHaveFocus();
});

test('an editable combobox says nothing about being read-only', () => {
  // `aria-readonly="false"` is the same as silence, at the cost of saying it.
  render(<Combobox options={OPTIONS} value="p0" onChange={() => {}} />);
  expect(screen.getByRole('button')).not.toHaveAttribute('aria-readonly');
});

test('disabled still opts out of the tab order — read-only did not replace it', async () => {
  render(<Combobox options={OPTIONS} value="p0" onChange={() => {}} disabled />);
  const trigger = screen.getByRole('button');
  expect(trigger).toBeDisabled();
  await userEvent.tab();
  expect(trigger).not.toHaveFocus();
});

test('a long label is cut by the trigger rather than overflowing it', () => {
  // jsdom has no layout, so the observable fact is which box holds the label:
  // the full string stays in the DOM — truncation is CSS, and a component that
  // shortened the text itself would break the accessible name and copy/paste —
  // inside an element that clips.
  render(
    <Combobox options={[{ value: 'l', label: LONG_LABEL }]} value="l" onChange={() => {}} />,
  );
  const label = screen.getByText(LONG_LABEL);
  expect(screen.getByRole('button')).toHaveTextContent(LONG_LABEL);
  expect(classes(label)).toContain('truncate');
});

test('a long label inside a coloured pill truncates too', () => {
  // The path that used to fail. A Pill is a flex item with the default
  // `min-width: auto`, so it refused to shrink and a long label pushed the
  // chevron out of the trigger instead of being cut. `min-w-0` on the pill is
  // what lets the inner `truncate` fire at all.
  render(
    <Combobox
      options={[{ value: 'l', label: LONG_LABEL, color: 'purple' }]}
      value="l"
      onChange={() => {}}
    />,
  );
  const label = screen.getByText(LONG_LABEL);
  expect(classes(label)).toContain('truncate');
  expect(classes(label.parentElement as HTMLElement)).toContain('min-w-0');
});

test('an unset tone is the resting neutral field, not a quiet primary', () => {
  // The contract's one rule that a default would silently break: a bordered
  // field left alone draws a neutral border and only takes colour when a tone
  // is named. Compared against a named tone rather than against a literal ramp
  // — which ramp `primary` resolves to is not this component's business.
  const props = { options: OPTIONS, value: null, onChange: () => {} };
  const { rerender } = render(<Combobox {...props} />);
  expect(classes(screen.getByRole('button'))).toContain('border-gray-7');

  rerender(<Combobox {...props} tone="primary" />);
  expect(classes(screen.getByRole('button'))).not.toContain('border-gray-7');
});
