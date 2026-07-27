import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { ToastProvider, useToast } from './toast';

function Harness() {
  const { toast } = useToast();
  return <button onClick={() => toast({ title: 'Saved to view Sprint 12' })}>save</button>;
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
