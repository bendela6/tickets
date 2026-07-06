import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { RadioGroup } from './radio-group';

test('selects an option and reports its value', async () => {
  const onValueChange = vi.fn();
  render(
    <RadioGroup
      name="density"
      label="Density"
      value="comfortable"
      options={[
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'compact', label: 'Compact' },
      ]}
      onValueChange={onValueChange}
    />,
  );
  await userEvent.click(screen.getByLabelText('Compact'));
  expect(onValueChange).toHaveBeenCalledWith('compact');
});
