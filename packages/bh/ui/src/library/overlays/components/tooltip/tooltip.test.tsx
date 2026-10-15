import { act, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
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

test('outside a TooltipProvider it brings its own, rather than throwing', async () => {
  render(
    <Tooltip content="Archived on Monday">
      <button>archive</button>
    </Tooltip>,
  );
  act(() => {
    screen.getByRole('button', { name: 'archive' }).focus();
  });
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Archived on Monday');
});

test('held by the caller, it shows while `open` is true, with nothing hovered', async () => {
  render(
    <Tooltip content="Saved two minutes ago" open>
      <button>save</button>
    </Tooltip>,
  );
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Saved two minutes ago');
});

test('held shut, a focus only asks `onOpenChange` to show it', async () => {
  const onOpenChange = vi.fn();
  render(
    <Tooltip content="Archived on Monday" open={false} onOpenChange={onOpenChange}>
      <button>archive</button>
    </Tooltip>,
  );
  act(() => {
    screen.getByRole('button', { name: 'archive' }).focus();
  });
  expect(onOpenChange).toHaveBeenCalledWith(true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test('left to itself, it tells `onOpenChange` as it shows and hides', async () => {
  const onOpenChange = vi.fn();
  render(
    <Tooltip content="Blocked by CORE-131" onOpenChange={onOpenChange}>
      <button>hover me</button>
    </Tooltip>,
  );
  const button = screen.getByRole('button', { name: 'hover me' });
  act(() => {
    button.focus();
  });
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  act(() => {
    button.blur();
  });
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});
