import { screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ApiError } from '../../api/api-error';
import type { AppReleaseRow, IssueRow as IssueRowData, SignalsAppDetail } from '../../api/signals/signals-api';
import { AppDetailScreen } from './app-detail-screen';
import { formatBytes } from './format';
import { renderSignals, type FetchRoute } from './test-utils';

afterEach(() => vi.unstubAllGlobals());

const APP: SignalsAppDetail = {
  id: 1,
  name: 'storefront-web',
  slug: 'storefront-web',
  ingestKey: 'pub_4f9c21ab',
  dsn: 'sgl://pub_4f9c21ab@127.0.0.1:4640/1',
  createdAt: '2026-03-12T00:00:00Z',
  signals24h: 3412,
  errors24h: 118,
};

const RELEASE: AppReleaseRow = {
  release: '1.44.1',
  signalCount: 812,
  errorCount: 6,
  sourcemapCount: 3,
  sourcemapBytes: 128_400,
  firstSeen: '2026-07-10T00:00:00Z',
  lastSeen: '2026-07-22T14:03:35Z',
};

const RECENT_ISSUE: IssueRowData = {
  id: 42,
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
  lastSeen: '2026-07-22T14:03:35Z',
  spark: [2, 3, 3, 4, 4, 5, 6, 6, 8, 9, 11, 13, 16, 18],
};

const appRoute = (): FetchRoute => ({
  test: /\/signals-api\/apps\/1$/,
  handler: () => APP,
});

const releasesRoute = (): FetchRoute => ({
  test: /\/signals-api\/apps\/1\/releases$/,
  handler: () => [RELEASE],
});

const issuesRoute = (): FetchRoute => ({
  test: /\/signals-api\/issues\?app=1&status=open&perPage=5$/,
  handler: () => ({ rows: [RECENT_ISSUE], total: 1 }),
});

test('shows the DSN, SDK snippet, a release row, and the recent issue filtered to the app', async () => {
  renderSignals(<AppDetailScreen appId={1} />, {
    fetchRoutes: [appRoute(), releasesRoute(), issuesRoute()],
  });

  // Connect card: DSN + default-react SDK snippet.
  expect(await screen.findByText(APP.dsn)).toBeInTheDocument();
  expect(screen.getByText(/@bendela6\/signals-react/)).toBeInTheDocument();

  // Releases card: the one release row with its counts + formatted bytes.
  expect(await screen.findByText('1.44.1')).toBeInTheDocument();
  expect(screen.getByText('812')).toBeInTheDocument();
  expect(screen.getByText('6')).toBeInTheDocument();
  const bytesText = formatBytes(RELEASE.sourcemapBytes);
  expect(screen.getByText((_, node) => node?.textContent === `3 (${bytesText})`)).toBeInTheDocument();

  // Recent issues card: the one open issue for this app.
  expect(screen.getByText('SGL-142 · src/checkout/CartList.tsx:48')).toBeInTheDocument();
});

test('a 404 on the app shows "App not found"', async () => {
  const { fetchMock } = renderSignals(<AppDetailScreen appId={1} />, {
    fetchRoutes: [
      {
        test: /\/signals-api\/apps\/1$/,
        handler: () => {
          throw new ApiError(404, 'not found');
        },
      },
    ],
  });

  expect(await screen.findByText('App not found')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalled();
});

test('a NaN appId renders "App not found" and never touches the network — both useSignalsApp and the recent-issues query must self-disable', async () => {
  const { fetchMock } = renderSignals(<AppDetailScreen appId={Number('abc')} />, { fetchRoutes: [] });

  expect(await screen.findByText('App not found')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a release with null firstSeen/lastSeen renders "—" for Last seen', async () => {
  const NO_DATES_RELEASE: AppReleaseRow = {
    ...RELEASE,
    release: '1.45.0-beta',
    firstSeen: null,
    lastSeen: null,
  };

  renderSignals(<AppDetailScreen appId={1} />, {
    fetchRoutes: [
      appRoute(),
      { test: /\/signals-api\/apps\/1\/releases$/, handler: () => [NO_DATES_RELEASE] },
      issuesRoute(),
    ],
  });

  expect(await screen.findByText('1.45.0-beta')).toBeInTheDocument();
  const row = screen.getByText('1.45.0-beta').closest('[role="row"]');
  expect(row).not.toBeNull();
  expect(row).toHaveTextContent('—');
});
