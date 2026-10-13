import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { expect, test, vi } from 'vitest';
import { ComboboxList } from './combobox-list';
import type { Option, OptionGroup } from '../../contract';

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

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', disabled: true },
  { value: 'banana', label: 'Banana' },
  { value: 'blueberry', label: 'Blueberry' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'damson', label: 'Damson', disabled: true },
];

test('the cursor opens on the chosen row, or on the first that can be picked', async () => {
  const onPick = vi.fn();
  const { unmount } = render(list({ options: FRUITS, onPick, isSelected: (v) => v === 'cherry' }));
  await userEvent.keyboard('{Enter}');
  expect(onPick).toHaveBeenLastCalledWith('cherry');
  unmount();

  render(list({ options: FRUITS, onPick }));
  await userEvent.keyboard('{Enter}');
  expect(onPick).toHaveBeenLastCalledWith('banana');
});

test('Home and End go to the first and last rows that can be picked', async () => {
  const onPick = vi.fn();
  render(list({ options: FRUITS, onPick }));
  await userEvent.keyboard('{End}{Enter}');
  expect(onPick).toHaveBeenLastCalledWith('cherry');
  await userEvent.keyboard('{Home}{Enter}');
  expect(onPick).toHaveBeenLastCalledWith('banana');
});

test('Home and End drive the list from the search box too', async () => {
  const onPick = vi.fn();
  render(list({ options: FRUITS, onPick, searchable: true }));
  await userEvent.keyboard('{End}{Enter}');
  expect(onPick).toHaveBeenLastCalledWith('cherry');
});

test('a query moves the cursor to the first row it leaves that can be picked', async () => {
  // "a" leaves Apple first, which is disabled; Enter there would do nothing.
  const onPick = vi.fn();
  render(list({ options: FRUITS, onPick, searchable: true }));
  await userEvent.type(screen.getByRole('searchbox'), 'a{Enter}');
  expect(onPick).toHaveBeenCalledExactlyOnceWith('banana');
});

test('without search, typing jumps to the first option that starts with it', async () => {
  const onPick = vi.fn();
  render(list({ options: FRUITS, onPick }));
  await userEvent.keyboard('ch{Enter}');
  expect(onPick).toHaveBeenCalledExactlyOnceWith('cherry');
});

test('without search, one letter again and again steps through the options it starts', async () => {
  // As on a native select, from the row under the cursor: the cursor opens on
  // Banana, so "b" goes on to Blueberry and "bb" comes back round to Banana.
  // Were "bb" a search for "bb", it would find nothing.
  const onPick = vi.fn();
  render(list({ options: FRUITS, onPick }));
  await userEvent.keyboard('b{Enter}');
  expect(onPick).toHaveBeenLastCalledWith('blueberry');
  await userEvent.keyboard('b{Enter}');
  expect(onPick).toHaveBeenLastCalledWith('banana');
});

test('without search, typing never lands on a disabled option', async () => {
  // Damson is the only "d", and disabled, so the cursor holds where it was.
  const onPick = vi.fn();
  render(list({ options: FRUITS, onPick }));
  await userEvent.keyboard('d{Enter}');
  expect(onPick).toHaveBeenCalledExactlyOnceWith('banana');
});

test('without search, a pause starts the typeahead over', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    const onPick = vi.fn();
    render(list({ options: FRUITS, onPick }));
    await userEvent.keyboard('c');
    vi.setSystemTime(Date.now() + 2000);
    // After the pause "b" is a search of its own, not "cb".
    await userEvent.keyboard('b{Enter}');
    expect(onPick).toHaveBeenCalledExactlyOnceWith('banana');
  } finally {
    vi.useRealTimers();
  }
});

test('without search, Space picks, but inside a typeahead it is part of the label', async () => {
  const options: Option[] = [
    { value: 'in', label: 'In' },
    { value: 'review', label: 'In review' },
  ];
  const onPick = vi.fn();
  render(list({ options, onPick }));
  await userEvent.keyboard(' ');
  expect(onPick).toHaveBeenLastCalledWith('in');
  await userEvent.keyboard('in r{Enter}');
  expect(onPick).toHaveBeenLastCalledWith('review');
});

test('the key that opened the list starts its typeahead', async () => {
  // Typed on the closed field: the list opens on the match, and the next key
  // goes on from it.
  const onPick = vi.fn();
  render(list({ options: FRUITS, onPick, openedWith: 'b' }));
  await userEvent.keyboard('l{Enter}');
  expect(onPick).toHaveBeenCalledExactlyOnceWith('blueberry');
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
  // Names the query rather than saying a bare "No matches", so it is obvious
  // the typing is the cause and not an empty source.
  expect(screen.getByText(/No matches for/)).toBeTruthy();
  expect(screen.getByText(/zzzz/)).toBeTruthy();
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

test('a resting mouse cannot change what Enter commits', async () => {
  // The old behaviour: onMouseEnter called setActiveIndex, so hovering a row
  // moved the keyboard cursor there and Enter picked it. A user arrowing with
  // the mouse parked anywhere over the list committed whatever was under the
  // pointer instead of what they had navigated to.
  const onPick = vi.fn();
  render(
    <ComboboxList
      options={[
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
        { value: 'c', label: 'Gamma' },
      ]}
      isSelected={() => false}
      onPick={onPick}
      searchable={false}
    />,
  );

  const rows = screen.getAllByRole('option');
  const third = rows[2];
  if (!third) {
    throw new Error('the list rendered fewer than three options');
  }
  await userEvent.hover(third);
  await userEvent.keyboard('{ArrowDown}{Enter}');

  // The cursor starts at 0; one ArrowDown puts it on 1. The hover over row 2
  // is visual only and must not have moved it.
  expect(onPick).toHaveBeenCalledWith('b');
});

test('the matched run is bolded, never colour-highlighted', async () => {
  // The design: "Match is bolded, never highlighted with colour." Colour here
  // would collide with the three channels the row already spends colour on —
  // cursor, hover and selection — and with option colours themselves.
  render(<ComboboxList options={OPTIONS} isSelected={() => false} onPick={() => {}} />);
  await userEvent.type(screen.getByRole('searchbox'), 'lph');

  const mark = screen.getByText('lph');
  expect(mark.tagName.toLowerCase()).toBe('b');
  expect(mark.className).not.toMatch(/bg-|text-(red|green|blue|indigo|orange)-/);
});

test('a filtered list says how much it is hiding', async () => {
  // The design shows "3 of 214". Without the total, a filter that hid almost
  // everything looks identical to a short list — you cannot tell whether to
  // keep typing or to clear the query.
  render(<ComboboxList options={OPTIONS} isSelected={() => false} onPick={() => {}} />);
  await userEvent.type(screen.getByRole('searchbox'), 'a');
  expect(screen.getByText(/of 3$/)).toBeTruthy();
});

test('an unfiltered list shows no count, because there is nothing to compare', async () => {
  render(<ComboboxList options={OPTIONS} isSelected={() => false} onPick={() => {}} />);
  expect(screen.queryByText(/ of \d+$/)).toBeNull();
});

test('an empty result names the query, and an empty list does not', async () => {
  // Two different empties, and the design distinguishes them: "No repository
  // matches 'zzz'" tells you your query is the cause, where a bare "No matches"
  // leaves you unsure whether anything was ever there. A list with no options
  // at all has no query to blame, so it must not invent one.
  const { rerender } = render(
    <ComboboxList options={OPTIONS} isSelected={() => false} onPick={() => {}} />,
  );
  await userEvent.type(screen.getByRole('searchbox'), 'zzz');
  expect(screen.getByText(/zzz/)).toBeTruthy();

  rerender(<ComboboxList options={[]} isSelected={() => false} onPick={() => {}} />);
  expect(screen.getByText('Nothing to pick')).toBeTruthy();
});

test('a hint can be offered alongside the empty result', async () => {
  render(
    <ComboboxList
      options={OPTIONS}
      isSelected={() => false}
      onPick={() => {}}
      noMatchHint="Check the spelling, or paste a full URL."
    />,
  );
  await userEvent.type(screen.getByRole('searchbox'), 'zzz');
  expect(screen.getByText(/Check the spelling/)).toBeTruthy();
});

test('loading draws skeleton rows rather than an empty state', async () => {
  // The design: "Skeleton rows keep the popup height stable." Showing the empty
  // state while options are still in flight says "there is nothing" when the
  // truth is "not yet" — and collapsing to a one-line message makes the popup
  // jump the moment results land.
  render(<ComboboxList options={[]} isSelected={() => false} onPick={() => {}} loading />);
  expect(screen.getAllByRole('presentation').length).toBeGreaterThan(1);
  expect(screen.queryByText('Nothing to pick')).toBeNull();
});

test('a loading list offers no options to arrow onto', () => {
  render(<ComboboxList options={[]} isSelected={() => false} onPick={() => {}} loading />);
  expect(screen.queryAllByRole('option')).toHaveLength(0);
});

test('a list searched elsewhere reports each keystroke and shows its options unfiltered', async () => {
  // The caller's options are already the server's matches for the query. A
  // second, local filter would hide a match whose label does not contain the
  // query — one the server found by id or alias.
  const onQueryChange = vi.fn();
  render(list({ searchable: true, onQueryChange }));
  await userEvent.type(screen.getByRole('searchbox'), 'zz');
  expect(onQueryChange).toHaveBeenLastCalledWith('zz');
  expect(screen.getByRole('option', { name: /alpha/i })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /gamma/i })).toBeInTheDocument();
});

// Statuses in an order that is NOT their groups' order, so a list that shows
// them as they came gets every grouped assertion below wrong.
const STATUSES: Option[] = [
  { value: 'dropped', label: 'Dropped', disabled: true, disabledReason: 'Only a lead drops work.' },
  { value: 'done', label: 'Done' },
  { value: 'doing', label: 'Doing' },
  { value: 'todo', label: 'To do' },
  {
    value: 'review',
    label: 'In review',
    disabled: true,
    disabledReason: "The workflow doesn't go from Doing to In review.",
  },
  { value: 'stray', label: 'Stray' },
];
const KIND: Record<string, string> = {
  todo: 'not-started',
  doing: 'started',
  review: 'started',
  dropped: 'finished',
  done: 'finished',
  stray: 'unlisted',
};
const KINDS: OptionGroup[] = [
  { key: 'not-started', label: 'Not started' },
  { key: 'started', label: 'Started' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'finished', label: 'Finished' },
];
const kindOf = (option: Option) => KIND[option.value] ?? 'unlisted';

/** Each group's name and its options' names, top to bottom. */
function shownGroups() {
  return screen.getAllByRole('group').map((group) => {
    const name = group.getAttribute('aria-labelledby');
    const heading = name ? document.getElementById(name)?.textContent : undefined;
    const options = within(group)
      .getAllByRole('option')
      .map((option) => option.textContent);
    return [heading, options];
  });
}

test('groups show under a heading each, in the order of `groups`', () => {
  // "Blocked" has no options, so it has no heading; "Stray" is in a group
  // `groups` doesn't list, so it isn't shown.
  render(list({ options: STATUSES, groupOf: kindOf, groups: KINDS }));
  expect(shownGroups()).toEqual([
    ['Not started', ['To do']],
    ['Started', ['Doing', 'In review']],
    ['Finished', ['Dropped', 'Done']],
  ]);
  expect(screen.getByRole('group', { name: 'Started' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Stray' })).toBeNull();
});

test('a search that empties a group takes its heading too', async () => {
  render(list({ options: STATUSES, groupOf: kindOf, groups: KINDS, searchable: true }));
  await userEvent.type(screen.getByRole('searchbox'), 'do');
  expect(shownGroups()).toEqual([
    ['Not started', ['To do']],
    ['Started', ['Doing']],
    ['Finished', ['Done']],
  ]);
  await userEvent.type(screen.getByRole('searchbox'), 'ne');
  expect(shownGroups()).toEqual([['Finished', ['Done']]]);
});

test('the arrows step over disabled rows from one group into the next', async () => {
  // To do, Doing, [In review], [Dropped], Done: two disabled rows sit either
  // side of the line between Started and Finished.
  const onPick = vi.fn();
  render(list({ options: STATUSES, groupOf: kindOf, groups: KINDS, onPick }));
  await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
  expect(onPick).toHaveBeenCalledExactlyOnceWith('done');
  await userEvent.keyboard('{ArrowUp}{Enter}');
  expect(onPick).toHaveBeenLastCalledWith('doing');
});

test('a disabled option says why, and a screen reader reads it with the option', () => {
  render(list({ options: STATUSES, groupOf: kindOf, groups: KINDS }));
  const review = screen.getByRole('option', { name: 'In review' });
  expect(review).toHaveAccessibleDescription("The workflow doesn't go from Doing to In review.");
  expect(screen.getByText("The workflow doesn't go from Doing to In review.")).toBeVisible();
});

test('a grouped list is a listbox of groups of options, as axe reads it', async () => {
  // A list item can't be a group, and one left between the listbox and its
  // options breaks the chain a screen reader follows from option to list.
  const { container } = render(list({ options: STATUSES, groupOf: kindOf, groups: KINDS }));
  const results = await axe.run(container, {
    runOnly: {
      type: 'rule',
      values: ['aria-allowed-role', 'aria-required-children', 'aria-required-parent', 'listitem'],
    },
  });
  const detail = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.html}`));
  expect(detail).toEqual([]);
});
