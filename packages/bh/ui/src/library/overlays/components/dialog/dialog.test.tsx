import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ConfirmDialog } from './dialog';

test('confirm dialog renders title/body and fires onConfirm', async () => {
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={() => {}}
      title="Archive CORE-128?"
      body="Archived tickets leave every view but stay findable."
      confirmLabel="Archive"
      destructive
      onConfirm={onConfirm}
    />,
  );
  expect(screen.getByText('Archive CORE-128?')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
  expect(onConfirm).toHaveBeenCalledOnce();
});

function Opener({ onConfirm = () => {} }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Archive
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Archive this?"
        confirmLabel="Yes, archive"
        onConfirm={onConfirm}
      />
    </>
  );
}

test.each(['Cancel', 'Yes, archive'])(
  'closing by %s returns focus to the button that opened it',
  async (name) => {
    const user = userEvent.setup();
    render(<Opener />);
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveFocus();
  },
);

test('Esc returns focus to the button that opened it too', async () => {
  const user = userEvent.setup();
  render(<Opener />);
  await user.click(screen.getByRole('button', { name: 'Archive' }));
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Archive' })).toHaveFocus();
});
