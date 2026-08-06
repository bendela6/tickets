import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

test('opens content on trigger click', async () => {
  render(
    <Popover>
      <PopoverTrigger>Open</PopoverTrigger>
      <PopoverContent>Panel body</PopoverContent>
    </Popover>,
  );
  expect(screen.queryByText('Panel body')).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('Open'));
  expect(await screen.findByText('Panel body')).toBeInTheDocument();
});
