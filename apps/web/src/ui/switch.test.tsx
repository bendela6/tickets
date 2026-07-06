import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { Switch } from './switch';

test('toggles checked state', async () => {
  render(<Switch label="KPI strip" />);
  const control = screen.getByRole('switch', { name: 'KPI strip' });
  expect(control).not.toBeChecked();
  await userEvent.click(control);
  expect(control).toBeChecked();
});
