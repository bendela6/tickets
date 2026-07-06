import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { DatePicker } from './date-picker';

test('opens to the value month and emits the picked day', async () => {
  const onChange = vi.fn();
  render(<DatePicker value="2026-07-12T00:00:00Z" onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: /jul 12, 2026/i }));
  expect(await screen.findByText('July 2026')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '15' }));
  expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^2026-07-15/));
});
