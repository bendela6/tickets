import { act, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Tooltip, TooltipProvider } from './tooltip';

test('shows tooltip content when the trigger is focused', async () => {
  render(
    <TooltipProvider>
      <Tooltip content="Blocked by CORE-131">
        <button>hover me</button>
      </Tooltip>
    </TooltipProvider>,
  );
  // radix opens the tooltip immediately on focus (no hover delay)
  act(() => {
    screen.getByRole('button', { name: 'hover me' }).focus();
  });
  expect(await screen.findAllByText('Blocked by CORE-131')).not.toHaveLength(0);
});
