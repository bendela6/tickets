import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { Combobox } from '@bh/ui';
import type { Option, StatusKind } from '../api/types';
import { statusChoices } from './status-choices';

function status(id: number, value: string, label: string, kind: StatusKind): Option {
  return { id, optionSetId: 1, value, label, position: id, kind, config: {}, archivedAt: null };
}

const STATUSES = [
  status(1, 'backlog', 'Backlog', 'todo'),
  status(2, 'in-progress', 'In progress', 'active'),
  status(3, 'in-review', 'In review', 'active'),
  status(4, 'blocked', 'Blocked', 'blocked'),
  status(5, 'shipped', 'Shipped', 'done'),
  status(6, 'wont-do', "Won't do", 'dropped'),
];
const byValue = (...values: string[]) => STATUSES.filter((s) => values.includes(s.value));

function Picker({
  from,
  legal,
  selected,
  onChange = () => {},
}: {
  from: string | null;
  legal: Option[];
  selected?: string | null;
  onChange?: (value: string | null) => void;
}) {
  const [value, setValue] = useState<string | null>(selected ?? from);
  return (
    <Combobox
      aria-label="Status"
      searchable={false}
      {...statusChoices(STATUSES, legal, from, selected ?? from)}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

test('lists every status under its kind, in the order work moves', async () => {
  render(<Picker from="in-progress" legal={STATUSES} />);
  await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
  const expected: [string, string[]][] = [
    ['To do', ['Backlog']],
    ['Active', ['In progress', 'In review']],
    ['Blocked', ['Blocked']],
    ['Done', ['Shipped']],
    ['Dropped', ["Won't do"]],
  ];
  const groups = screen.getAllByRole('group');
  expect(groups).toHaveLength(expected.length);
  expected.forEach(([heading, labels], at) => {
    const group = screen.getByRole('group', { name: heading });
    expect(group).toBe(groups[at]);
    expect(within(group).getAllByRole('option')).toHaveLength(labels.length);
    for (const label of labels) {
      expect(within(group).getByRole('option', { name: label })).toBeInTheDocument();
    }
  });
});

test("shows a move the workflow doesn't make, disabled, saying why", async () => {
  render(<Picker from="in-progress" legal={byValue('in-progress', 'in-review', 'blocked', 'shipped')} />);
  await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));

  const backlog = screen.getByRole('option', { name: 'Backlog' });
  expect(backlog).toBeDisabled();
  expect(backlog).toHaveAccessibleDescription("The workflow doesn't go from In progress to Backlog.");
  expect(screen.getByRole('option', { name: "Won't do" })).toBeDisabled();

  const review = screen.getByRole('option', { name: 'In review' });
  expect(review).toBeEnabled();
  expect(review).not.toHaveAccessibleDescription();
  // The status the item is in stays pickable.
  expect(screen.getByRole('option', { name: 'In progress' })).toBeEnabled();
});

test('a disabled move cannot be picked; an allowed one reports its value', async () => {
  const onChange = vi.fn();
  render(
    <Picker
      from="in-progress"
      legal={byValue('in-progress', 'in-review', 'shipped')}
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
  await userEvent.click(screen.getByRole('option', { name: 'Backlog' }));
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('option', { name: 'Shipped' }));
  expect(onChange).toHaveBeenCalledWith('shipped');
  expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Shipped');
});

test('a new item says where the workflow starts, and keeps the status it was given', async () => {
  render(<Picker from={null} selected="blocked" legal={byValue('backlog')} />);
  await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
  expect(screen.getByRole('option', { name: 'Shipped' })).toHaveAccessibleDescription(
    "The workflow doesn't start at Shipped.",
  );
  expect(screen.getByRole('option', { name: 'Backlog' })).toBeEnabled();
  expect(screen.getByRole('option', { name: 'Blocked' })).toBeEnabled();
});
