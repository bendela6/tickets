import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { SignalsAppDetail, SignalsAppRow } from '../../api/signals/signals-api';
import { AppsScreen } from './apps-screen';
import { renderSignals, type FetchRoute } from './test-utils';

afterEach(() => vi.unstubAllGlobals());

function app(overrides: Partial<SignalsAppRow> = {}): SignalsAppRow {
  return {
    id: 1,
    name: 'storefront-web',
    slug: 'storefront-web',
    createdAt: '2026-03-12T00:00:00Z',
    signals24h: 3412,
    errors24h: 118,
    ...overrides,
  };
}

const APP_A = app();
const APP_B = app({
  id: 2,
  name: 'admin-panel',
  slug: 'admin-panel',
  signals24h: 214,
  errors24h: 0,
  createdAt: '2026-06-20T00:00:00Z',
});

const metaRoute: FetchRoute = {
  test: /\/signals-api\/meta$/,
  handler: () => ({ dbSizeBytes: 2_252_000_000 }),
};

test('(a) renders app rows with 24h counts and the db-size footer', async () => {
  renderSignals(<AppsScreen />, {
    fetchRoutes: [{ test: /\/signals-api\/apps$/, handler: () => [APP_A, APP_B] }, metaRoute],
    initialPath: '/signals/apps',
  });

  expect(await screen.findByText('storefront-web')).toBeInTheDocument();
  expect(screen.getByText('admin-panel')).toBeInTheDocument();
  expect(screen.getByText('3,412')).toBeInTheDocument();
  expect(screen.getByText('118')).toBeInTheDocument();
  // admin-panel has 0 errors24h — renders the em-dash, not "0".
  expect(screen.getByText('—')).toBeInTheDocument();
  expect(await screen.findByText(/2\.1 GB on disk/)).toBeInTheDocument();
  expect(screen.getByText(/2 apps · sending to .*\/signals-api/)).toBeInTheDocument();
});

test('(b) empty list shows "Connect your first app"', async () => {
  renderSignals(<AppsScreen />, {
    fetchRoutes: [{ test: /\/signals-api\/apps$/, handler: () => [] }, metaRoute],
    initialPath: '/signals/apps',
  });

  expect(await screen.findByText('Connect your first app')).toBeInTheDocument();
});

test('(c) New app → type name → submit posts /signals-api/apps and shows the success panel + snippet tabs', async () => {
  const created: SignalsAppDetail = {
    id: 3,
    name: 'worker-billing',
    slug: 'worker-billing',
    ingestKey: 'pub_4f9c21ab',
    dsn: 'sgl://pub_4f9c21ab@127.0.0.1:4640/3',
    createdAt: '2026-07-22T00:00:00Z',
  };

  let posted = false;
  renderSignals(<AppsScreen />, {
    fetchRoutes: [
      {
        test: /\/signals-api\/apps$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            posted = true;
            expect(JSON.parse(String(init.body))).toEqual({ name: 'worker-billing' });
            return created;
          }
          return [];
        },
      },
      metaRoute,
    ],
    initialPath: '/signals/apps',
  });

  await screen.findByText('Connect your first app');
  fireEvent.click(screen.getByRole('button', { name: /New app/ }));

  const nameInput = await screen.findByLabelText('Name');
  fireEvent.change(nameInput, { target: { value: 'worker-billing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create app' }));

  await waitFor(() => expect(posted).toBe(true));
  expect(await screen.findByText(/is ready/)).toBeInTheDocument();
  expect(screen.getByText(created.dsn)).toBeInTheDocument();
  // Defaults to the React tab's snippet.
  expect(screen.getByText(/@bendela6\/signals-react/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Node' }));
  expect(await screen.findByText(/@bendela6\/signals-node/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: '<script>' }));
  expect(await screen.findByText(/sdk\.js/)).toBeInTheDocument();
});
