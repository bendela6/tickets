import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { SignalListRow } from '../../api/signals/signals-api';
import { ActivityScreen } from './activity-screen';
import { renderSignals, type FetchRoute } from './test-utils';

afterEach(() => vi.unstubAllGlobals());

function signal(overrides: Partial<SignalListRow> = {}): SignalListRow {
  return {
    id: 1,
    appId: 1,
    appSlug: 'storefront-web',
    kind: 'log',
    name: 'console.log',
    message: 'checkout started',
    level: 'info',
    mechanism: null,
    sessionId: 'sess-abc123',
    clientTimestamp: '2026-07-22T00:00:00Z',
    receivedAt: '2026-07-22T00:00:05Z',
    ...overrides,
  };
}

const LOG_ROW = signal();
const EVENT_ROW = signal({
  id: 2,
  kind: 'event',
  name: 'checkout.completed',
  message: null,
  appSlug: 'admin-panel',
  sessionId: null,
});

const appsRoute: FetchRoute = { test: /\/signals-api\/apps$/, handler: () => [] };

test('(a) renders a log row and an event row, each with its kind glyph', async () => {
  renderSignals(<ActivityScreen />, {
    fetchRoutes: [
      appsRoute,
      { test: /\/signals-api\/signals\?/, handler: () => ({ rows: [LOG_ROW, EVENT_ROW], total: 2 }) },
    ],
  });

  expect(await screen.findByText('console.log')).toBeInTheDocument();
  expect(screen.getByText('checkout.completed')).toBeInTheDocument();
  expect(screen.getByText('storefront-web')).toBeInTheDocument();
  expect(screen.getByText('admin-panel')).toBeInTheDocument();
  expect(screen.getAllByRole('img', { name: 'log' }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('img', { name: 'event' }).length).toBeGreaterThan(0);
});

test('(b) switching the kind filter to "log" refetches with kind=log', async () => {
  const { fetchMock } = renderSignals(<ActivityScreen />, {
    fetchRoutes: [
      appsRoute,
      { test: /\/signals-api\/signals\?/, handler: () => ({ rows: [LOG_ROW, EVENT_ROW], total: 2 }) },
    ],
  });

  await screen.findByText('console.log');
  fetchMock.mockClear();

  fireEvent.change(screen.getByLabelText('Filter by kind'), { target: { value: 'log' } });

  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('kind=log'))).toBe(true);
  });
});

test('(c) an empty payload shows the empty state', async () => {
  renderSignals(<ActivityScreen />, {
    fetchRoutes: [appsRoute, { test: /\/signals-api\/signals\?/, handler: () => ({ rows: [], total: 0 }) }],
  });

  expect(await screen.findByText(/No activity yet/)).toBeInTheDocument();
});

test('(d) a rejected fetch shows the error state with a Retry button', async () => {
  renderSignals(<ActivityScreen />, {
    fetchRoutes: [
      appsRoute,
      {
        test: /\/signals-api\/signals\?/,
        handler: () => {
          throw new Error('connection refused');
        },
      },
    ],
  });

  expect(await screen.findByText("Couldn't load activity")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
});

test('(e) typing in search updates the request URL with q= after the debounce', async () => {
  const { fetchMock } = renderSignals(<ActivityScreen />, {
    fetchRoutes: [
      appsRoute,
      { test: /\/signals-api\/signals\?/, handler: () => ({ rows: [LOG_ROW], total: 1 }) },
    ],
  });

  await screen.findByText('console.log');
  fetchMock.mockClear();

  vi.useFakeTimers();
  try {
    fireEvent.change(screen.getByPlaceholderText(/Search message, name/), {
      target: { value: 'boom' },
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
  } finally {
    vi.useRealTimers();
  }

  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('q=boom'))).toBe(true);
  });
});
