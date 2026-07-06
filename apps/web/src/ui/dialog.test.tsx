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
