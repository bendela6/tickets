import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { SignalsAppDetail, SignalsAppRow } from '../../api/signals/signals-api';
import { RotateKeyDialog } from './rotate-key-dialog';
import { renderSignals } from './test-utils';

afterEach(() => vi.unstubAllGlobals());

const APP: Pick<SignalsAppRow, 'id' | 'name' | 'slug'> = {
  id: 9,
  name: 'storefront-web',
  slug: 'storefront-web',
};

const ROTATED: SignalsAppDetail = {
  id: 9,
  name: 'storefront-web',
  slug: 'storefront-web',
  ingestKey: 'pub_ab12cd34',
  dsn: 'sgl://pub_ab12cd34@127.0.0.1:4640/9',
  createdAt: '2026-03-12T00:00:00Z',
};

test('confirm is disabled until the exact slug is typed, then rotates the app id and shows the new DSN', async () => {
  let rotateCalled = false;
  const onOpenChange = vi.fn();

  renderSignals(<RotateKeyDialog app={APP} open onOpenChange={onOpenChange} />, {
    fetchRoutes: [
      {
        test: /\/signals-api\/apps\/9\/rotate$/,
        handler: (_url, init) => {
          expect(init?.method).toBe('POST');
          rotateCalled = true;
          return ROTATED;
        },
      },
    ],
  });

  // The dialog renders inside a memory-history RouterProvider (renderSignals'
  // harness) — its route resolves asynchronously, so the first query must be
  // a `find*`, same as delete-app-dialog.test.tsx's convention.
  const confirmButton = await screen.findByRole('button', { name: 'Rotate key' });
  expect(confirmButton).toBeDisabled();

  const input = screen.getByLabelText(/type/i);

  // A near-miss (wrong slug) must not enable the button.
  fireEvent.change(input, { target: { value: 'storefront-we' } });
  expect(confirmButton).toBeDisabled();
  expect(rotateCalled).toBe(false);

  fireEvent.change(input, { target: { value: 'storefront-web' } });
  expect(confirmButton).not.toBeDisabled();

  fireEvent.click(confirmButton);

  await waitFor(() => expect(rotateCalled).toBe(true));

  // On success the dialog swaps in place (no close) to show the new DSN.
  expect(await screen.findByText(ROTATED.dsn)).toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalledWith(false);
});

test('a rejected rotate keeps the confirm panel open and shows the inline error', async () => {
  const onOpenChange = vi.fn();

  renderSignals(<RotateKeyDialog app={APP} open onOpenChange={onOpenChange} />, {
    fetchRoutes: [
      {
        test: /\/signals-api\/apps\/9\/rotate$/,
        handler: () => {
          throw new Error('app not found');
        },
      },
    ],
  });

  const input = await screen.findByLabelText(/type/i);
  fireEvent.change(input, { target: { value: 'storefront-web' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rotate key' }));

  expect(await screen.findByText('app not found')).toBeInTheDocument();
  // Still on the confirm panel, not the post-rotate DSN panel.
  expect(screen.queryByText(ROTATED.dsn)).not.toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalledWith(false);
});
