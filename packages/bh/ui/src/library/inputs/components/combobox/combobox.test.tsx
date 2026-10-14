import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Icon, type IconName } from '../../../primitives/components/icon';
import { Combobox } from './combobox';
import type { Option, OptionGroup } from '../../contract';

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
  const search = await screen.findByRole('searchbox');
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
  await userEvent.click(screen.getByRole('combobox'));
  expect(await screen.findAllByRole('option')).toHaveLength(3);
  expect(screen.queryByRole('searchbox')).toBeNull();
});

test('searchable={false} keeps the keyboard model the search box used to own', async () => {
  // The input carried autoFocus, onKeyDown and aria-activedescendant. Removing
  // it must not strand focus on the trigger, or arrows would scroll the page
  // instead of moving the selection.
  const onChange = vi.fn();
  render(<Combobox options={OPTIONS} value={null} onChange={onChange} searchable={false} />);
  await userEvent.click(screen.getByRole('combobox'));
  const list = await screen.findByRole('listbox');
  expect(list).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}{Enter}');
  expect(onChange).toHaveBeenCalledWith('p1');
});

test('with a search box the field stays a button, named by what it shows', () => {
  // The searching field can't take role=combobox until its call sites are
  // labelled: a combobox takes no name from its content. See the component.
  render(<Combobox options={OPTIONS} value="p0" onChange={() => {}} />);
  expect(screen.getByRole('button', { name: 'P0 · critical' })).toHaveAttribute(
    'aria-haspopup',
    'dialog',
  );
  expect(screen.queryByRole('combobox')).toBeNull();
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
  expect(trigger).toHaveAttribute('aria-disabled', 'true');
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
  // An editable trigger says nothing at all: the attribute is absent rather
  // than present-and-false, which is the same information at the cost of
  // saying it.
  render(<Combobox options={OPTIONS} value="p0" onChange={() => {}} />);
  expect(screen.getByRole('button')).not.toHaveAttribute('aria-disabled');
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
  render(<Combobox options={[{ value: 'l', label: LONG_LABEL }]} value="l" onChange={() => {}} />);
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
  expect(classes(screen.getByRole('button'))).toContain('bg-gray-5');

  rerender(<Combobox {...props} tone="primary" />);
  expect(classes(screen.getByRole('button'))).not.toContain('bg-gray-5');
});

test('tone danger is what announces invalid, as on every field', () => {
  const { container, rerender } = render(
    <Combobox options={OPTIONS} value={null} onChange={() => {}} placeholder="Priority" />,
  );
  expect(container.querySelector('[aria-invalid]')).toBeNull();
  rerender(
    <Combobox
      options={OPTIONS}
      value={null}
      onChange={() => {}}
      placeholder="Priority"
      tone="danger"
    />,
  );
  expect(container.querySelector('button')).toHaveAttribute('aria-invalid', 'true');
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

function Statuses({ onChange = () => {} }: { onChange?: (value: string | null) => void }) {
  return (
    <Combobox
      options={STATUSES}
      value={null}
      onChange={onChange}
      placeholder="Status"
      groupOf={(option) => KIND[option.value] ?? ''}
      groups={KINDS}
    />
  );
}

test('groups show under a heading each, in the order of `groups`', async () => {
  // "Blocked" has no options, so it has no heading either.
  render(<Statuses />);
  await userEvent.click(screen.getByRole('button', { name: 'Status' }));
  const headings = ['Not started', 'Started', 'Finished'];
  expect(await screen.findAllByRole('group')).toEqual(
    headings.map((name) => screen.getByRole('group', { name })),
  );
  const started = within(screen.getByRole('group', { name: 'Started' })).getAllByRole('option');
  expect(started.map((option) => option.textContent)).toEqual(['Doing', 'In review']);
});

test('the arrows step over disabled rows from one group into the next', async () => {
  // To do, Doing, [In review], [Dropped], Done: two disabled rows sit either
  // side of the line between Started and Finished.
  const onChange = vi.fn();
  render(<Statuses onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Status' }));
  await screen.findByRole('searchbox');
  await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
  expect(onChange).toHaveBeenCalledExactlyOnceWith('done');
});

test('a disabled option says why, and a screen reader reads it with the option', async () => {
  render(<Statuses />);
  await userEvent.click(screen.getByRole('button', { name: 'Status' }));
  expect(await screen.findByRole('option', { name: 'Dropped' })).toHaveAccessibleDescription(
    'Only a lead drops work.',
  );
});

// Without search the Combobox is a select. What `Select` guaranteed, before it
// went, it guarantees here.

const TYPES: Option[] = [
  { value: 'task', label: 'Task', color: 'blue' },
  { value: 'bug', label: 'Bug', color: 'red' },
  { value: 'chore', label: 'Chore' },
  { value: 'spike', label: 'Spike', disabled: true },
];

function Select(props: Partial<Parameters<typeof Combobox>[0]>) {
  return (
    <Combobox options={TYPES} value={null} onChange={() => {}} {...props} searchable={false} />
  );
}

const openSelect = async () => userEvent.click(screen.getByRole('combobox'));

test('without search, the field is a combobox whose popup is a listbox', async () => {
  render(<Select aria-label="Type" />);
  const field = screen.getByRole('combobox', { name: 'Type' });
  expect(field).toHaveAttribute('aria-haspopup', 'listbox');
  expect(field).toHaveAttribute('aria-expanded', 'false');
  await openSelect();
  expect(field).toHaveAttribute('aria-expanded', 'true');
});

test('without search, the value is PLAIN TEXT, never a chip', () => {
  // A chip says "one of several things I am holding" about a control that
  // holds exactly one.
  render(<Select value="task" />);
  const field = screen.getByRole('combobox');
  expect(field).toHaveTextContent('Task');
  expect(field.querySelector('[data-chip]')).toBeNull();
  expect(field.className).not.toMatch(/bg-blue-\d/);
});

test('without search, a coloured option keeps its dot on the field, because that is data', () => {
  const { container } = render(<Select value="task" />);
  expect(container.querySelector('.bg-blue-9')).not.toBeNull();
});

test('without search, an uncoloured option draws no dot', () => {
  const { container } = render(<Select value="chore" />);
  expect(container.querySelector('[class*="rounded-full"]')).toBeNull();
});

test('without search, the placeholder stands in for an empty value', () => {
  render(<Select placeholder="Choose a type" />);
  expect(screen.getByRole('combobox')).toHaveTextContent('Choose a type');
});

test('without search, picking commits and closes', async () => {
  const onChange = vi.fn();
  render(<Select onChange={onChange} />);
  await openSelect();
  await userEvent.click(screen.getByRole('option', { name: 'Bug' }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith('bug');
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('without search, the cursor opens on the chosen row, so Enter changes nothing', async () => {
  // Opening onto row 0 would mean Enter silently moved the value to whatever
  // happened to be first.
  const onChange = vi.fn();
  render(<Select value="chore" onChange={onChange} />);
  await openSelect();
  await userEvent.keyboard('{Enter}');
  expect(onChange).toHaveBeenCalledExactlyOnceWith('chore');
});

test('without search, with nothing chosen, the cursor opens on the first row that can be picked', async () => {
  // Not on row 0 when row 0 is disabled: Enter there would do nothing at all.
  const onChange = vi.fn();
  render(
    <Select
      options={[
        { value: 'spike', label: 'Spike', disabled: true },
        { value: 'task', label: 'Task' },
      ]}
      onChange={onChange}
    />,
  );
  await openSelect();
  await userEvent.keyboard('{Enter}');
  expect(onChange).toHaveBeenCalledExactlyOnceWith('task');
});

test('without search, the cursor steps over a disabled row rather than resting on it', async () => {
  const onChange = vi.fn();
  render(<Select value="chore" onChange={onChange} />);
  await openSelect();
  await userEvent.keyboard('{ArrowDown}{Enter}');
  // 'spike' is disabled and is the only row below 'chore', so the cursor holds.
  expect(onChange).toHaveBeenCalledExactlyOnceWith('chore');
});

test('without search, a disabled option refuses the pointer too', async () => {
  const onChange = vi.fn();
  render(<Select onChange={onChange} />);
  await openSelect();
  await userEvent.click(screen.getByRole('option', { name: 'Spike' }));
  expect(onChange).not.toHaveBeenCalled();
});

test('without search, Enter, Space and the arrows open the list from the field', async () => {
  for (const key of ['{Enter}', ' ', '{ArrowDown}', '{ArrowUp}']) {
    const { unmount } = render(<Select value="bug" />);
    screen.getByRole('combobox').focus();
    await userEvent.keyboard(key);
    // Opened at the chosen row, with the focus in the list so the keys work.
    const list = await screen.findByRole('listbox');
    expect(list).toHaveFocus();
    const current = document.getElementById(list.getAttribute('aria-activedescendant') ?? '');
    expect(current).toHaveTextContent('Bug');
    unmount();
  }
});

test('without search, Space picks in the list as Enter does', async () => {
  const onChange = vi.fn();
  render(<Select value="task" onChange={onChange} />);
  await openSelect();
  await userEvent.keyboard('{ArrowDown} ');
  expect(onChange).toHaveBeenCalledExactlyOnceWith('bug');
});

test('without search, typing in the list jumps to the option that starts with it', async () => {
  const onChange = vi.fn();
  render(<Select value="task" onChange={onChange} />);
  await openSelect();
  await userEvent.keyboard('c{Enter}');
  expect(onChange).toHaveBeenLastCalledWith('chore');
});

test('without search, typing on the closed field opens the list at the option it starts', async () => {
  // As a native select: the field need not be opened first.
  const onChange = vi.fn();
  render(<Select value="task" onChange={onChange} />);
  screen.getByRole('combobox').focus();
  await userEvent.keyboard('b');
  expect(await screen.findByRole('listbox')).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(onChange).toHaveBeenCalledExactlyOnceWith('bug');
});

test('without search, keys typed one after another on the closed field make one search', async () => {
  // "ch" is Chore. Were the "h" a search of its own it would find nothing,
  // and the cursor would stay on Cat, where "c" alone stopped.
  const onChange = vi.fn();
  render(
    <Select
      options={[
        { value: 'cat', label: 'Cat' },
        { value: 'chore', label: 'Chore' },
      ]}
      onChange={onChange}
    />,
  );
  screen.getByRole('combobox').focus();
  await userEvent.keyboard('ch{Enter}');
  expect(onChange).toHaveBeenCalledExactlyOnceWith('chore');
});

test('without search, read-only keeps the tab stop, refuses to open and drops the chevron', async () => {
  const { container } = render(<Select value="task" readOnly />);
  const field = screen.getByRole('combobox');
  await userEvent.tab();
  expect(field).toHaveFocus();
  await userEvent.click(field);
  await userEvent.keyboard('{ArrowDown}b');
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(field).not.toBeDisabled();
  expect(field).toHaveAttribute('aria-disabled', 'true');
  // A chevron promises a list that will not open.
  expect(container.querySelector('svg')).toBeNull();
});

test('without search, tone danger is what announces invalid — there is no invalid prop', () => {
  const { rerender } = render(<Select value="task" />);
  expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid');
  rerender(<Select value="task" tone="danger" />);
  expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
});

test('without search, an empty list says so rather than opening onto nothing', async () => {
  render(<Select options={[]} />);
  await openSelect();
  expect(screen.getByText('Nothing to pick')).toBeInTheDocument();
});

function GroupedSelect({
  value = null,
  onChange = () => {},
}: {
  value?: string | null;
  onChange?: (value: string | null) => void;
}) {
  return (
    <Select
      aria-label="Status"
      options={STATUSES}
      value={value}
      onChange={onChange}
      groupOf={(option) => KIND[option.value] ?? ''}
      groups={KINDS}
    />
  );
}

test('without search, groups show under a heading each, in the order of `groups`', async () => {
  // "Blocked" has no options, so it has no heading either; "Stray" is in a
  // group `groups` doesn't list, so it isn't shown.
  render(<GroupedSelect />);
  await openSelect();
  const headings = ['Not started', 'Started', 'Finished'];
  expect(screen.getAllByRole('group')).toEqual(
    headings.map((name) => screen.getByRole('group', { name })),
  );
  const started = within(screen.getByRole('group', { name: 'Started' })).getAllByRole('option');
  expect(started.map((option) => option.textContent)).toEqual(['Doing', 'In review']);
  expect(screen.queryByRole('option', { name: 'Stray' })).toBeNull();
});

test('without search, the arrows step over disabled rows from one group into the next', async () => {
  // To do, Doing, [In review], [Dropped], Done: two disabled rows sit either
  // side of the line between Started and Finished.
  const onChange = vi.fn();
  render(<GroupedSelect value="doing" onChange={onChange} />);
  await openSelect();
  await userEvent.keyboard('{ArrowDown}{Enter}');
  expect(onChange).toHaveBeenCalledExactlyOnceWith('done');
});

test('without search, Home and End go to the ends of the list as it is shown', async () => {
  const onChange = vi.fn();
  render(<GroupedSelect value="doing" onChange={onChange} />);
  await openSelect();
  await userEvent.keyboard('{End}{Enter}');
  expect(onChange).toHaveBeenLastCalledWith('done');
  await openSelect();
  await userEvent.keyboard('{Home}{Enter}');
  expect(onChange).toHaveBeenLastCalledWith('todo');
});

test('without search, typing skips a disabled option and keeps the order the groups give', async () => {
  // "d" from Doing: Dropped is disabled, so it is Done, under Finished.
  const onChange = vi.fn();
  render(<GroupedSelect value="doing" onChange={onChange} />);
  await openSelect();
  await userEvent.keyboard('d{Enter}');
  expect(onChange).toHaveBeenCalledExactlyOnceWith('done');
});

test('without search, a disabled option says why, and a screen reader reads it with the option', async () => {
  render(<GroupedSelect value="doing" />);
  await openSelect();
  const review = screen.getByRole('option', { name: 'In review' });
  expect(review).toHaveAccessibleDescription("The workflow doesn't go from Doing to In review.");
  expect(screen.getByText("The workflow doesn't go from Doing to In review.")).toBeVisible();
});

test('without search, the field names its value even when the list leaves its group out', () => {
  render(<GroupedSelect value="stray" />);
  expect(screen.getByRole('combobox')).toHaveTextContent('Stray');
});

test('without search, two on one page keep their own option ids', async () => {
  // `Select` named its options from their values alone, so two on one page
  // shared ids, and the second list's cursor named a row of the first. Only
  // one popover is open at a time, so the ids are gathered as each list opens:
  // together they must still be unique.
  render(
    <>
      <Select />
      <Select />
    </>,
  );
  const ids: string[] = [];
  for (const field of screen.getAllByRole('combobox')) {
    await userEvent.click(field);
    const list = await screen.findByRole('listbox');
    await userEvent.keyboard('{ArrowDown}');
    const options = within(list).getAllByRole('option');
    ids.push(...options.map((option) => option.id));
    // The cursor names a row of this list, not the same row of the other one.
    const current = document.getElementById(list.getAttribute('aria-activedescendant') ?? '');
    expect(list).toContainElement(current);
    expect(current).toHaveTextContent('Bug');
    await userEvent.keyboard('{Escape}');
  }
  expect(ids).toHaveLength(TYPES.length * 2);
  expect(new Set(ids).size).toBe(ids.length);
});

// An option's `icon`: before its label in the list, and on the field once
// chosen, as a colour's dot is. The same list draws it without search, and
// under MultiCombobox.

const WITH_ICONS: Option[] = [
  { value: 'todo', label: 'To do', icon: 'circle' },
  { value: 'doing', label: 'In progress', icon: 'circle-half', color: 'blue' },
  { value: 'done', label: 'Done', icon: 'circle-check' },
  { value: 'later', label: 'Later' },
];

/** The glyph an Icon draws for `name`, to find it among others. */
function glyph(name: IconName): string {
  const { container, unmount } = render(<Icon name={name} />);
  const drawn = container.querySelector('svg')?.innerHTML ?? '';
  unmount();
  return drawn;
}

/** The glyphs drawn inside an element, in order. */
function glyphsIn(element: HTMLElement): string[] {
  return [...element.querySelectorAll('svg')].map((svg) => svg.innerHTML);
}

test('the list draws an option’s icon before its label', async () => {
  render(<Combobox options={WITH_ICONS} value={null} onChange={() => {}} placeholder="Status" />);
  await userEvent.click(screen.getByRole('button', { name: /status/i }));

  const done = await screen.findByRole('option', { name: 'Done' });
  expect(glyphsIn(done)).toEqual([glyph('circle-check')]);
  // Before the label: the glyph is the row's first child.
  expect(done.firstElementChild?.tagName.toLowerCase()).toBe('svg');
  // An option with none draws none.
  expect(glyphsIn(screen.getByRole('option', { name: 'Later' }))).toEqual([]);
});

test('the field draws the chosen option’s icon, then its dot, then its label', () => {
  render(<Combobox options={WITH_ICONS} value="doing" onChange={() => {}} />);
  const field = screen.getByRole('button', { name: /in progress/i });

  // The icon, and the chevron after the label.
  expect(glyphsIn(field)).toEqual([glyph('circle-half'), glyph('chevron-down')]);
  const value = field.firstElementChild as HTMLElement;
  expect(value.firstElementChild?.tagName.toLowerCase()).toBe('svg');
  expect(value.querySelector('.bg-blue-9')).not.toBeNull();
});

test('without search, the list and the field draw the icon too', async () => {
  render(<Select options={WITH_ICONS} value="done" />);
  expect(glyphsIn(screen.getByRole('combobox'))[0]).toBe(glyph('circle-check'));

  await openSelect();
  expect(glyphsIn(await screen.findByRole('option', { name: 'To do' }))).toEqual([glyph('circle')]);
});

test('without search, the list is at least the field’s width and grows with its rows, to 320px', async () => {
  render(<Select />);
  await openSelect();
  const popup = screen.getByRole('listbox').closest<HTMLElement>('[role="dialog"]');
  if (!popup) {
    throw new Error('the list has no popup around it');
  }
  // jsdom lays nothing out, so this holds the contract the browser draws:
  // as wide as its content, no narrower than the field, no wider than 320.
  expect(classes(popup)).toEqual(
    expect.arrayContaining(['w-max', 'min-w-(--radix-popover-trigger-width)', 'max-w-320']),
  );
});

test('with search, the list keeps a width of its own', async () => {
  render(<Combobox options={OPTIONS} value={null} onChange={() => {}} placeholder="Priority" />);
  await userEvent.click(screen.getByRole('button', { name: /priority/i }));
  const popup = (await screen.findByRole('listbox')).closest<HTMLElement>('[role="dialog"]');
  expect(popup && classes(popup)).not.toContain('w-max');
});
