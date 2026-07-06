import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { StatusSelect } from './status-select';

const STATUSES = [
  { key: 'backlog', label: 'Backlog', kind: 'todo' as const },
  { key: 'in-progress', label: 'In progress', kind: 'active' as const },
  { key: 'in-review', label: 'In review', kind: 'active' as const },
  { key: 'blocked', label: 'Blocked', kind: 'blocked' as const },
  { key: 'shipped', label: 'Shipped', kind: 'done' as const },
  { key: 'wont-do', label: "Won't do", kind: 'dropped' as const },
];

test('shows only legal targets (plus current) and a hidden count', async () => {
  render(
    <StatusSelect
      statuses={STATUSES}
      value="in-progress"
      legalTargets={['in-review', 'blocked', 'shipped']}
      onChange={() => {}}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /in progress/i }));
  expect(await screen.findByRole('option', { name: /in review/i })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /backlog/i })).not.toBeInTheDocument();
  expect(screen.getByText(/2 statuses hidden by workflow/i)).toBeInTheDocument();
});

test('selecting a target emits its key', async () => {
  const onChange = vi.fn();
  render(
    <StatusSelect
      statuses={STATUSES}
      value="in-progress"
      legalTargets={['in-review', 'blocked', 'shipped']}
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /in progress/i }));
  await userEvent.click(await screen.findByRole('option', { name: /shipped/i }));
  expect(onChange).toHaveBeenCalledWith('shipped');
});
