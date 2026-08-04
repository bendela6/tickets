import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Drawer } from '../drawer';
import { ToastProvider, useToast } from './toast';

function Harness({ onUndo }: { onUndo?: () => void } = {}) {
  const { toast } = useToast();
  return (
    <button
      onClick={() =>
        toast({
          title: 'Saved to view Sprint 12',
          ...(onUndo ? { action: { label: 'Undo', onClick: onUndo } } : {}),
        })
      }
    >
      save
    </button>
  );
}

test('toast appears after being triggered', async () => {
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'save' }));
  expect(await screen.findByText('Saved to view Sprint 12')).toBeInTheDocument();
});

// The undo affordance is the whole point of a toast, and a save is exactly the
// thing a user does from inside a drawer. A modal layer puts
// `pointer-events: none` on <body> and aria-hidden on every subtree outside
// its portal — the toast viewport lives in the app tree and is caught by both.
test('a toast raised from inside a modal drawer stays clickable and visible to assistive tech', async () => {
  const onUndo = vi.fn();
  function DrawerHost() {
    const [open, setOpen] = useState(false);
    return (
      <ToastProvider>
        <button type="button" onClick={() => setOpen(true)}>
          Open it
        </button>
        <Drawer open={open} onOpenChange={setOpen} label="Detail">
          <Harness onUndo={onUndo} />
        </Drawer>
      </ToastProvider>
    );
  }
  render(<DrawerHost />);
  await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
  expect(document.body.style.pointerEvents).toBe('none');
  await userEvent.click(screen.getByRole('button', { name: 'save' }));

  const undo = await screen.findByRole('button', { name: 'Undo' });
  // userEvent refuses to click through `pointer-events: none`, which is the
  // failure a real user hits: the button is on screen and does nothing.
  await userEvent.click(undo);
  expect(onUndo).toHaveBeenCalledTimes(1);

  // And nothing between the toast and <body> is hidden from a screen reader.
  for (let el: HTMLElement | null = undo; el; el = el.parentElement) {
    expect(el.getAttribute('aria-hidden')).not.toBe('true');
  }
});
