import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { SignalsAppRow } from '../../api/signals/signals-api';
import { DeleteAppDialog } from './delete-app-dialog';
import { renderSignals } from './test-utils';

afterEach(() => vi.unstubAllGlobals());

const APP: Pick<SignalsAppRow, 'id' | 'name' | 'slug'> = {
  id: 7,
  name: 'storefront-web',
  slug: 'storefront-web',
};

test('confirm is disabled until the exact slug is typed, then deletes {id} on confirm', async () => {
  let deleteCalled = false;
  const onOpenChange = vi.fn();

  renderSignals(<DeleteAppDialog app={APP} open onOpenChange={onOpenChange} />, {
    fetchRoutes: [
      {
        test: /\/signals-api\/apps\/7$/,
        handler: (_url, init) => {
          expect(init?.method).toBe('DELETE');
          deleteCalled = true;
          return { deleted: true };
        },
      },
    ],
  });

  // The dialog renders inside a memory-history RouterProvider (renderSignals'
  // harness) — its route resolves asynchronously, so the first query must be
  // a `find*`, same as apps-screen.test.tsx's convention.
  const confirmButton = await screen.findByRole('button', { name: 'Delete app' });
  expect(confirmButton).toBeDisabled();

  const input = screen.getByLabelText(/type/i);

  // A near-miss (wrong slug) must not enable the button.
  fireEvent.change(input, { target: { value: 'storefront-we' } });
  expect(confirmButton).toBeDisabled();
  expect(deleteCalled).toBe(false);

  fireEvent.change(input, { target: { value: 'storefront-web' } });
  expect(confirmButton).not.toBeDisabled();

  fireEvent.click(confirmButton);

  await waitFor(() => expect(deleteCalled).toBe(true));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

test('a rejected delete keeps the dialog open and shows the inline error, never calling mutate with the wrong id', async () => {
  const onOpenChange = vi.fn();

  renderSignals(<DeleteAppDialog app={APP} open onOpenChange={onOpenChange} />, {
    fetchRoutes: [
      {
        test: /\/signals-api\/apps\/7$/,
        handler: () => {
          throw new Error('app has active sessions');
        },
      },
    ],
  });

  const input = await screen.findByLabelText(/type/i);
  fireEvent.change(input, { target: { value: 'storefront-web' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete app' }));

  expect(await screen.findByText('app has active sessions')).toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalledWith(false);
});
