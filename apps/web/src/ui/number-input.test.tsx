import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { NumberInput } from './number-input';

test('stepper increments and typing updates the value', async () => {
  const onChange = vi.fn();
  render(<NumberInput value={8} onChange={onChange} step={1} />);
  await userEvent.click(screen.getByRole('button', { name: /increment/i }));
  expect(onChange).toHaveBeenCalledWith(9);
});

test('clearing the field emits null', async () => {
  const onChange = vi.fn();
  render(<NumberInput value={8} onChange={onChange} />);
  await userEvent.clear(screen.getByRole('spinbutton'));
  expect(onChange).toHaveBeenLastCalledWith(null);
});
