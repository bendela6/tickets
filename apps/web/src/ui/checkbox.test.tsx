import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Checkbox } from './checkbox';

test('toggles via label click', async () => {
  const onChange = vi.fn();
  render(<Checkbox label="Show KPI strip" onChange={onChange} />);
  await userEvent.click(screen.getByLabelText('Show KPI strip'));
  expect(onChange).toHaveBeenCalledOnce();
});
