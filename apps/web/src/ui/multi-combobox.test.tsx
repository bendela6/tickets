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
  render(<MultiCombobox options={OPTIONS} value={['frontend']} onChange={onChange} placeholder="Labels" />);
  await userEvent.click(screen.getByRole('button', { name: /labels/i }));
  await userEvent.click(await screen.findByRole('button', { name: /select all/i }));
  expect(onChange).toHaveBeenCalledWith(['frontend', 'api', 'infra']);
});

test('removing a chip deselects it', async () => {
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: /remove frontend/i }));
  expect(onChange).toHaveBeenCalledWith(['api']);
});
