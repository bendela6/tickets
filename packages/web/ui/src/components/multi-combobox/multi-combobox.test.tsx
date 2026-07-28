import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { MultiCombobox } from './multi-combobox';

const OPTIONS = [
  { value: 'frontend', label: 'frontend', color: 'blue' as const },
  { value: 'api', label: 'api', color: 'green' as const },
  { value: 'infra', label: 'infra', color: 'gray' as const },
];

test('toggles a selection on and keeps the panel open', async () => {
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={[]} onChange={onChange} placeholder="Labels" />);
  await userEvent.click(screen.getByRole('button', { name: /labels/i }));
  await userEvent.click(await screen.findByRole('option', { name: /frontend/i }));
  expect(onChange).toHaveBeenCalledWith(['frontend']);
  // still open → list present
  expect(screen.getByRole('option', { name: /api/i })).toBeInTheDocument();
});

test('select all picks every option', async () => {
  const onChange = vi.fn();
  render(
    <MultiCombobox
      options={OPTIONS}
      value={['frontend']}
      onChange={onChange}
      placeholder="Labels"
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /labels/i }));
  await userEvent.click(await screen.findByRole('button', { name: /select all/i }));
  expect(onChange).toHaveBeenCalledWith(['frontend', 'api', 'infra']);
});

test('deselecting happens in the popover, not on the trigger', async () => {
  // The chips are read-only. Picking an already-selected option toggles it off,
  // with the full set visible — an X on the trigger removed a value from a list
  // you could not see, next to the control that opens it.
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={onChange} />);
  expect(screen.queryByRole('button', { name: /remove frontend/i })).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: /select/i }));
  await userEvent.click(await screen.findByRole('option', { name: /frontend/i }));
  expect(onChange).toHaveBeenCalledWith(['api']);
});

test('the trigger carries no clear-all affordance', () => {
  render(<MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={() => {}} />);
  expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull();
});

test('the whole trigger opens the popover, not only the chevron', async () => {
  render(<MultiCombobox options={OPTIONS} value={['frontend']} onChange={() => {}} />);
  const trigger = screen.getByRole('button', { name: /select/i });
  // The shell itself is the button: the chips and the chevron are inside it,
  // so there is no dead area between them.
  expect(trigger.querySelector('svg')).not.toBeNull();
  expect(trigger.textContent).toContain('frontend');

  await userEvent.click(trigger);
  expect(await screen.findByRole('listbox')).toBeTruthy();
});
