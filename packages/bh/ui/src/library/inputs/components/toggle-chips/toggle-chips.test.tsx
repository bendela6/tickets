import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ToggleChips } from './toggle-chips';

const STATUSES = [
  { value: 'running', label: 'Running', color: 'indigo' as const },
  { value: 'failed', label: 'Failed', color: 'red' as const },
  { value: 'waiting', label: 'Waiting', color: 'orange' as const },
];

const MANY = [
  ...STATUSES,
  { value: 'paused', label: 'Paused' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
];

test('is a labelled group of toggle buttons that say whether they are pressed', () => {
  render(<ToggleChips label="Status" options={STATUSES} value={['failed']} onChange={() => {}} />);
  expect(screen.getByRole('group', { name: 'Status' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Failed' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Running' })).toHaveAttribute('aria-pressed', 'false');
});

test('pressing a chip adds its value, pressing it again takes it out', async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <ToggleChips label="Status" options={STATUSES} value={['failed']} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Running' }));
  expect(onChange).toHaveBeenLastCalledWith(['failed', 'running']);

  rerender(
    <ToggleChips
      label="Status"
      options={STATUSES}
      value={['failed', 'running']}
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Failed' }));
  expect(onChange).toHaveBeenLastCalledWith(['running']);
});

test('lays out only the first few and keeps the rest one click away', async () => {
  const onChange = vi.fn();
  render(
    <ToggleChips
      label="Status"
      options={MANY}
      value={['cancelled']}
      maxVisible={4}
      onChange={onChange}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Pending' })).toBeNull();
  const more = screen.getByRole('button', { name: /2 more status options/i });
  // A value pressed behind the overflow still shows on the chip that hides it.
  expect(more).toHaveTextContent('(1)');

  await userEvent.click(more);
  await userEvent.click(await screen.findByRole('option', { name: /pending/i }));
  expect(onChange).toHaveBeenCalledWith(['cancelled', 'pending']);
});

test('a read-only group says so and changes nothing', async () => {
  const onChange = vi.fn();
  render(<ToggleChips label="Status" options={STATUSES} value={[]} onChange={onChange} readOnly />);
  const chip = screen.getByRole('button', { name: 'Running' });
  expect(chip).toHaveAttribute('aria-disabled', 'true');
  expect(chip).not.toBeDisabled();
  await userEvent.click(chip);
  expect(onChange).not.toHaveBeenCalled();
});

test('a pressed chip with no colour of its own paints from tone; one with a colour keeps it', () => {
  render(
    <ToggleChips
      label="Status"
      tone="teal"
      options={MANY}
      value={['failed', 'paused']}
      onChange={() => {}}
      maxVisible={6}
    />,
  );
  expect(screen.getByRole('button', { name: 'Paused' }).className).toContain('bg-teal-3');
  expect(screen.getByRole('button', { name: 'Failed' }).className).toContain('bg-red-3');
});

test('the +N chip, pressed, paints from tone too', () => {
  render(
    <ToggleChips
      label="Status"
      tone="danger"
      options={MANY}
      value={['cancelled']}
      onChange={() => {}}
      maxVisible={3}
    />,
  );
  expect(screen.getByRole('button', { name: /more status options/ }).className).toContain(
    'bg-red-3',
  );
});

test("draws an option's count after its label, in the chip's name, and nothing without one", () => {
  render(
    <ToggleChips
      label="Status"
      options={[
        { value: 'todo', label: 'To do', count: 14 },
        { value: 'done', label: 'Done' },
      ]}
      value={[]}
      onChange={() => {}}
    />,
  );
  const todo = screen.getByRole('button', { name: 'To do 14' });
  expect(todo.lastElementChild).toHaveTextContent('14');
  expect(todo.lastElementChild).toHaveClass('font-mono', 'text-11');
  expect(screen.getByRole('button', { name: 'Done' }).children).toHaveLength(0);
});
