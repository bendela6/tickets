import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { IssueRow } from '../../api/signals/signals-api';
import { IssuesScreen } from './issues-screen';
import { renderSignals, type FetchRoute } from './test-utils';

afterEach(() => vi.unstubAllGlobals());

function issue(overrides: Partial<IssueRow> = {}): IssueRow {
  return {
    id: 1,
    key: 'SGL-142',
    title: "TypeError — Cannot read properties of undefined (reading 'map')",
    culprit: 'src/checkout/CartList.tsx:48',
    appId: 1,
    appSlug: 'storefront-web',
    status: 'open',
    level: 'error',
    mechanism: null,
    eventCount: 4213,
    firstSeen: '2026-07-10T00:00:00Z',
    lastSeen: '2026-07-22T00:00:00Z',
    spark: [2, 3, 3, 4, 4, 5, 6, 6, 8, 9, 11, 13, 16, 18],
    ...overrides,
  };
}

const ISSUE_A = issue();
const ISSUE_B = issue({
  id: 2,
  key: 'SGL-097',
  title: 'ReferenceError — analytics is not defined',
  culprit: 'src/boot/telemetry.ts:12',
  appSlug: 'admin-panel',
  eventCount: 89,
});

function countRoutes(counts: { open?: number; resolved?: number; ignored?: number } = {}): FetchRoute[] {
  return [
    { test: /status=open&perPage=1$/, handler: () => ({ rows: [], total: counts.open ?? 0 }) },
    { test: /status=resolved&perPage=1$/, handler: () => ({ rows: [], total: counts.resolved ?? 0 }) },
    { test: /status=ignored&perPage=1$/, handler: () => ({ rows: [], total: counts.ignored ?? 0 }) },
  ];
}

const appsRoute: FetchRoute = { test: /\/signals-api\/apps$/, handler: () => [] };

test('(a) renders rows from a 2-row issues payload', async () => {
  renderSignals(<IssuesScreen />, {
    fetchRoutes: [
      appsRoute,
      ...countRoutes({ open: 2 }),
      { test: /perPage=25$/, handler: () => ({ rows: [ISSUE_A, ISSUE_B], total: 2 }) },
    ],
  });

  expect(await screen.findByText(/SGL-142/)).toBeInTheDocument();
  expect(screen.getByText(/SGL-097/)).toBeInTheDocument();
  expect(screen.getByText('TypeError')).toBeInTheDocument();
  expect(screen.getByText('ReferenceError')).toBeInTheDocument();
  expect(screen.getByText('4,213')).toBeInTheDocument();
  expect(screen.getByText('89')).toBeInTheDocument();
  expect(screen.getByText('storefront-web')).toBeInTheDocument();
  expect(screen.getByText('admin-panel')).toBeInTheDocument();
});

test('(b) clicking Resolve PATCHes /signals-api/issues/1 and refetches the list', async () => {
  let resolved = false;
  const { fetchMock } = renderSignals(<IssuesScreen />, {
    fetchRoutes: [
      appsRoute,
      ...countRoutes({ open: 1 }),
      {
        test: /\/signals-api\/issues\/1$/,
        handler: (_url, init) => {
          expect(init?.method).toBe('PATCH');
          expect(JSON.parse(String(init?.body))).toEqual({ status: 'resolved' });
          resolved = true;
          return { ...ISSUE_A, status: 'resolved' };
        },
      },
      { test: /perPage=25$/, handler: () => ({ rows: [ISSUE_A], total: 1 }) },
    ],
  });

  await screen.findByText(/SGL-142/);
  const listCallsBefore = fetchMock.mock.calls.filter(([url]) => /perPage=25$/.test(String(url))).length;

  fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

  await waitFor(() => expect(resolved).toBe(true));
  await waitFor(() => {
    const listCallsAfter = fetchMock.mock.calls.filter(([url]) => /perPage=25$/.test(String(url))).length;
    expect(listCallsAfter).toBeGreaterThan(listCallsBefore);
  });
});

test('(c) a rejected fetch shows the error state with a Retry button', async () => {
  renderSignals(<IssuesScreen />, {
    fetchRoutes: [
      appsRoute,
      ...countRoutes(),
      {
        test: /perPage=25$/,
        handler: () => {
          throw new Error('connection refused');
        },
      },
    ],
  });

  expect(await screen.findByText("Couldn't load issues")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
});

test('(d) an empty payload shows the "No open issues" empty state', async () => {
  renderSignals(<IssuesScreen />, {
    fetchRoutes: [appsRoute, ...countRoutes(), { test: /perPage=25$/, handler: () => ({ rows: [], total: 0 }) }],
  });

  expect(await screen.findByText(/No open issues/)).toBeInTheDocument();
});

test('(e) typing in search updates the request URL with q= after the 300ms debounce', async () => {
  const { fetchMock } = renderSignals(<IssuesScreen />, {
    fetchRoutes: [
      appsRoute,
      ...countRoutes({ open: 1 }),
      { test: /perPage=25$/, handler: () => ({ rows: [ISSUE_A], total: 1 }) },
    ],
  });

  await screen.findByText(/SGL-142/);
  fetchMock.mockClear();

  vi.useFakeTimers();
  try {
    fireEvent.change(screen.getByPlaceholderText(/Search message, type, file/), {
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
