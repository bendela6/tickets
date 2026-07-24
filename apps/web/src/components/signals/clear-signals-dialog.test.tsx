import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { AppReleaseRow, SignalsAppRow } from '../../api/signals/signals-api';
import { ClearSignalsDialog } from './clear-signals-dialog';
import { renderSignals, type FetchRoute } from './test-utils';

afterEach(() => vi.unstubAllGlobals());

const APP: Pick<SignalsAppRow, 'id' | 'name' | 'slug'> = {
  id: 3,
  name: 'admin-panel',
  slug: 'admin-panel',
};

const RELEASE: AppReleaseRow = {
  release: '2.0.0',
  signalCount: 40,
  errorCount: 2,
  sourcemapCount: 0,
  sourcemapBytes: 0,
  firstSeen: '2026-07-01T00:00:00Z',
  lastSeen: '2026-07-20T00:00:00Z',
};

const releasesRoute = (): FetchRoute => ({
  test: /\/signals-api\/apps\/3\/releases$/,
  handler: () => [RELEASE],
});

test('mode=All sends {} — a DELETE with no query string', async () => {
  let capturedUrl: string | null = null;

  renderSignals(<ClearSignalsDialog app={APP} open onOpenChange={vi.fn()} />, {
    fetchRoutes: [
      releasesRoute(),
      {
        test: /\/signals-api\/apps\/3\/signals/,
        handler: (url, init) => {
          expect(init?.method).toBe('DELETE');
          capturedUrl = url;
          return { deletedSignals: 5, prunedIssues: 1 };
        },
      },
    ],
  });

  // The dialog renders inside a memory-history RouterProvider (renderSignals'
  // harness) — its route resolves asynchronously, so the first query must be
  // a `find*`, same as apps-screen.test.tsx's convention. "All signals" is
  // the default mode, so no need to touch the radio group.
  fireEvent.click(await screen.findByRole('button', { name: 'Clear signals' }));

  await waitFor(() => expect(capturedUrl).not.toBeNull());
  expect(capturedUrl).toMatch(/\/signals-api\/apps\/3\/signals$/);
  expect(await screen.findByText(/Removed 5 signals/)).toBeInTheDocument();
});

test('mode=Older than sends a {before} ISO cutoff', async () => {
  let capturedUrl: string | null = null;

  renderSignals(<ClearSignalsDialog app={APP} open onOpenChange={vi.fn()} />, {
    fetchRoutes: [
      releasesRoute(),
      {
        test: /\/signals-api\/apps\/3\/signals/,
        handler: (url) => {
          capturedUrl = url;
          return { deletedSignals: 2, prunedIssues: 0 };
        },
      },
    ],
  });

  fireEvent.click(await screen.findByRole('radio', { name: 'Older than' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear signals' }));

  await waitFor(() => expect(capturedUrl).not.toBeNull());
  const url = new URL(capturedUrl!, 'http://localhost');
  const before = url.searchParams.get('before');
  expect(before).not.toBeNull();
  // Round-trips through Date -> toISOString unchanged, i.e. it really is an
  // ISO timestamp and not some other encoding.
  expect(new Date(before!).toISOString()).toBe(before);
  // Default "older than" window is 7 days — roughly a week back from now.
  const ageMs = Date.now() - new Date(before!).getTime();
  expect(ageMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  expect(ageMs).toBeLessThan(8 * 24 * 60 * 60 * 1000);
});

test('mode=Release sends {release}, and the confirm button stays disabled until one is chosen', async () => {
  let capturedUrl: string | null = null;

  renderSignals(<ClearSignalsDialog app={APP} open onOpenChange={vi.fn()} />, {
    fetchRoutes: [
      releasesRoute(),
      {
        test: /\/signals-api\/apps\/3\/signals/,
        handler: (url) => {
          capturedUrl = url;
          return { deletedSignals: 40, prunedIssues: 1 };
        },
      },
    ],
  });

  fireEvent.click(await screen.findByRole('radio', { name: 'Release' }));

  const confirmButton = screen.getByRole('button', { name: 'Clear signals' });
  expect(confirmButton).toBeDisabled();

  const select = await screen.findByRole('combobox', { name: 'Release' });
  fireEvent.change(select, { target: { value: '2.0.0' } });

  expect(confirmButton).not.toBeDisabled();
  fireEvent.click(confirmButton);

  await waitFor(() => expect(capturedUrl).not.toBeNull());
  expect(capturedUrl).toMatch(/[?&]release=2\.0\.0(&|$)/);
});
