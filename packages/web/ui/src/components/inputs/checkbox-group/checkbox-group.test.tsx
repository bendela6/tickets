import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { CheckboxGroup } from './checkbox-group';

const FILTERS = [
  { value: 'assigned', label: 'Assigned to me' },
  { value: 'watching', label: 'Watching' },
  { value: 'mentioned', label: 'Mentioned me' },
  { value: 'locked', label: 'Archived', disabled: true },
];

test('toggling adds and removes from the array', async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <CheckboxGroup label="Filters" options={FILTERS} value={[]} onChange={onChange} />,
  );
  await userEvent.click(screen.getByLabelText('Watching'));
  expect(onChange).toHaveBeenCalledWith(['watching']);

  rerender(<CheckboxGroup label="Filters" options={FILTERS} value={['watching']} onChange={onChange} />);
  await userEvent.click(screen.getByLabelText('Watching'));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

test('the parent is genuinely indeterminate, not a third colour', async () => {
  // A half-selected parent painted as "checked but paler" is indistinguishable
  // from a disabled one. The platform gives a real indeterminate for this.
  render(
    <CheckboxGroup
      label="Filters"
      options={FILTERS}
      value={['watching']}
      onChange={() => {}}
      selectAllLabel="All filters"
    />,
  );
  const parent = screen.getByLabelText('All filters') as HTMLInputElement;
  expect(parent.indeterminate).toBe(true);
  expect(parent.checked).toBe(false);
});

test('the parent is checked only when every reachable option is on', () => {
  // A disabled option nobody can reach must not hold the parent permanently
  // indeterminate.
  render(
    <CheckboxGroup
      label="Filters"
      options={FILTERS}
      value={['assigned', 'watching', 'mentioned']}
      onChange={() => {}}
      selectAllLabel="All filters"
    />,
  );
  const parent = screen.getByLabelText('All filters') as HTMLInputElement;
  expect(parent.checked).toBe(true);
  expect(parent.indeterminate).toBe(false);
});

test('the parent sets every reachable option, and leaves the rest alone', async () => {
  const onChange = vi.fn();
  render(
    <CheckboxGroup
      label="Filters"
      options={FILTERS}
      value={[]}
      onChange={onChange}
      selectAllLabel="All filters"
    />,
  );
  await userEvent.click(screen.getByLabelText('All filters'));
  expect(onChange).toHaveBeenCalledWith(['assigned', 'watching', 'mentioned']);
});

test('clearing keeps a disabled option that was already on', async () => {
  // The parent controls what the user could have set by hand, and nothing else.
  const onChange = vi.fn();
  render(
    <CheckboxGroup
      label="Filters"
      options={FILTERS}
      value={['assigned', 'watching', 'mentioned', 'locked']}
      onChange={onChange}
      selectAllLabel="All filters"
    />,
  );
  await userEvent.click(screen.getByLabelText('All filters'));
  expect(onChange).toHaveBeenCalledWith(['locked']);
});

test('the legend names the group and is hidden unless asked for', () => {
  // A fieldset cannot be named from outside — `for` points at a form control.
  const { rerender } = render(
    <CheckboxGroup label="Filters" options={FILTERS} value={[]} onChange={() => {}} />,
  );
  expect(screen.getByRole('group', { name: 'Filters' })).toBeInTheDocument();
  expect(screen.getByText('Filters').className).toContain('sr-only');

  rerender(<CheckboxGroup label="Filters" options={FILTERS} value={[]} onChange={() => {}} showLabel />);
  expect(screen.getByText('Filters').className).not.toContain('sr-only');
});

test('read-only refuses every toggle but keeps the tab stops', async () => {
  const onChange = vi.fn();
  render(
    <CheckboxGroup label="Filters" options={FILTERS} value={['watching']} onChange={onChange} readOnly />,
  );
  await userEvent.click(screen.getByLabelText('Watching'));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Watching')).not.toBeDisabled();
});
