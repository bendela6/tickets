import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ComboboxList } from './combobox-list';
import type { Option } from '../control';

const OPTIONS: Option[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Gamma' },
];

const LONG = 'Platform · ingestion · deduplicate inbound webhook payloads before fan-out';

function list(props: Partial<Parameters<typeof ComboboxList>[0]> = {}) {
  return (
    <ComboboxList
      options={OPTIONS}
      isSelected={() => false}
      onPick={() => {}}
      searchable={false}
      {...props}
    />
  );
}

test('arrowing skips a disabled option rather than stopping on it', async () => {
  // Enter on a highlighted disabled row did nothing at all — no move, no pick,
  // no sound. The highlight never stops where Enter cannot act.
  const onPick = vi.fn();
  render(list({ onPick }));
  await userEvent.keyboard('{ArrowDown}{Enter}');
  expect(onPick).toHaveBeenCalledExactlyOnceWith('c');
});

test('arrowing back up skips it too, and stops rather than wrapping', async () => {
  const onPick = vi.fn();
  render(list({ onPick }));
  await userEvent.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}{Enter}');
  expect(onPick).toHaveBeenCalledExactlyOnceWith('a');
});

test('an empty option set says so, rather than blaming a filter', async () => {
  // "No matches" in front of a list that was never populated reads as though
  // something is hidden, and sends you looking for a filter to clear.
  render(list({ options: [] }));
  expect(screen.getByText('Nothing to pick')).toBeTruthy();
  expect(screen.queryByText('No matches')).toBeNull();
});

test('a filter that hides everything says THAT instead', async () => {
  render(list({ searchable: true }));
  await userEvent.type(screen.getByRole('searchbox'), 'zzzz');
  expect(screen.getByText('No matches')).toBeTruthy();
  expect(screen.queryByText('Nothing to pick')).toBeNull();
});

test('a long option label is cut by the row rather than pushing the tick out', () => {
  // jsdom has no layout, so the observable fact is which classes are present:
  // the row may shrink, and the label truncates inside it. Same trap the
  // trigger had, and the same fix.
  render(list({ options: [{ value: 'l', label: LONG }] }));
  const label = screen.getByText(LONG);
  expect(label.className).toContain('truncate');
  expect(screen.getByRole('option').className).toContain('min-w-0');
});

test('a long label inside a coloured pill truncates too', () => {
  render(list({ options: [{ value: 'l', label: LONG, color: 'purple' }] }));
  const label = screen.getByText(LONG);
  expect(label.className).toContain('truncate');
  expect((label.parentElement as HTMLElement).className).toContain('min-w-0');
});
