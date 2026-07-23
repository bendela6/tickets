import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ApiError } from '../../api/api-error';
import type { IssueDetail, OccurrencePage, SessionTimeline } from '../../api/signals/signals-api';
import { IssueDetailScreen } from './issue-detail-screen';
import { renderSignals, type FetchRoute } from './test-utils';

afterEach(() => vi.unstubAllGlobals());

function issueDetail(overrides: Partial<IssueDetail> = {}): IssueDetail {
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
    lastSeen: '2026-07-22T14:03:35Z',
    spark: [2, 3, 3, 4, 4, 5, 6, 6, 8, 9, 11, 13, 16, 18],
    sessionCount: 1847,
    userCount: 312,
    releaseRange: { first: '1.42.0', last: '1.44.1' },
    ...overrides,
  };
}

const ISSUE = issueDetail();

const OCC_NEWEST = { id: 501, receivedAt: '2026-07-22T14:03:35Z', release: '1.44.1', sessionId: 'sess_9f3k21' };
const OCC_OLDER = { id: 500, receivedAt: '2026-07-22T14:01:12Z', release: '1.44.1', sessionId: 'sess_2mq8ce' };

// The newest occurrence's session, with a symbolicated stack (one in-app
// frame + contextLines), a raw fallback stack, and breadcrumbs incl. an http
// 500. Row id (501) matches OCC_NEWEST.id — the "matching signal id" wiring
// the brief calls for.
const SESSION_SYM: SessionTimeline = {
  session: {
    sessionId: 'sess_9f3k21',
    appId: 1,
    appSlug: 'storefront-web',
    startedAt: '2026-07-22T14:00:00Z',
    endedAt: '2026-07-22T14:03:36Z',
    durationMs: 216_000,
    crashed: true,
    counts: { error: 1, log: 3, event: 7 },
    release: '1.44.1',
    platform: { runtime: 'browser', os: 'macOS 14.5', browser: 'Chrome 126' },
  },
  rows: [
    {
      id: 501,
      kind: 'error',
      name: 'TypeError',
      message: "Cannot read properties of undefined (reading 'map')",
      mechanism: null,
      level: 'error',
      clientTimestamp: '2026-07-22T14:03:35Z',
      issueId: 1,
      issueKey: 'SGL-142',
      payload: {
        stackSymbolicated: [
          {
            functionName: 'CartList',
            file: 'src/checkout/CartList.tsx',
            line: 48,
            column: 21,
            inApp: true,
            contextLines: [
              { line: 46, text: 'if (cart.loading) return <Skeleton rows={3} />;' },
              { line: 47, text: '' },
              { line: 48, text: 'const rows = cart.items.map((it) => toRow(it));' },
              { line: 49, text: 'return <Table rows={rows} />;' },
            ],
          },
        ],
        stack: [
          { functionName: 't.map', file: '/assets/index-8f3a91.js', line: 14, column: 20993, inApp: false },
        ],
        // 'fetch' is not a wire-legal breadcrumb `type` (the SDK only ever
        // emits console|click|navigation|http|custom — see
        // packages/signals/core/src/types.ts) and there is no 'error'
        // breadcrumb either; the terminal row is synthesized by the screen
        // from the matched error signal itself (name/message/
        // clientTimestamp on the row below), not from this list.
        breadcrumbs: [
          { type: 'navigation', timestamp: '2026-07-22T14:03:28Z', message: '/checkout' },
          { type: 'console', timestamp: '2026-07-22T14:03:29Z', message: 'cart hydrate: 3 items' },
          {
            type: 'http',
            timestamp: '2026-07-22T14:03:30Z',
            message: 'GET /api/cart',
            data: { status: 200, durationMs: 214 },
          },
          { type: 'click', timestamp: '2026-07-22T14:03:33Z', message: 'button#apply-coupon' },
          {
            type: 'http',
            timestamp: '2026-07-22T14:03:34Z',
            message: 'POST /api/coupon',
            data: { status: 500, durationMs: 1210 },
          },
        ],
        user: { id: 'usr_29c1', email: 'j.lang@example.com' },
        tags: { environment: 'production', handled: 'no' },
        contexts: {
          checkout: { cart_items: 3, coupon: 'SUMMER10', total_cents: 8340 },
          event: { should: 'be-skipped' },
        },
        platform: { runtime: 'browser', browser: 'Chrome 126', os: 'macOS 14.5' },
        sdk: { name: '@bendela6/signals-browser', version: '0.1.0' },
      },
    },
  ],
};

const issueRoute = (): FetchRoute => ({
  test: /\/signals-api\/issues\/1$/,
  handler: () => ISSUE,
});

function occurrencesRoute(page: OccurrencePage): FetchRoute {
  return {
    test: /\/signals-api\/issues\/1\/signals\?page=1&perPage=25$/,
    handler: () => page,
  };
}

const sessionSymRoute: FetchRoute = {
  test: /\/signals-api\/sessions\/sess_9f3k21\/signals$/,
  handler: () => SESSION_SYM,
};

test('(a) header shows name/status/culprit and stats (sessionCount, releaseRange)', async () => {
  renderSignals(<IssueDetailScreen issueId={1} />, {
    fetchRoutes: [issueRoute(), occurrencesRoute({ rows: [OCC_NEWEST], total: 1 }), sessionSymRoute],
  });

  // 'TypeError' now also appears in the breadcrumbs card's synthesized
  // terminal row (see the (d) test below), so anchor on the unique message
  // text first and use getAllByText (never throws on >1 match) for the name.
  expect(await screen.findByText("— Cannot read properties of undefined (reading 'map')")).toBeInTheDocument();
  expect(screen.getAllByText('TypeError').length).toBeGreaterThan(0);
  expect(screen.getByText('open')).toBeInTheDocument();
  expect(screen.getByText('SGL-142 · src/checkout/CartList.tsx:48')).toBeInTheDocument();
  expect(screen.getByText('storefront-web')).toBeInTheDocument();
  expect(screen.getByText('4,213')).toBeInTheDocument();
  expect(screen.getByText('1,847')).toBeInTheDocument();
  expect(screen.getByText(/1\.42\.0 → 1\.44\.1/)).toBeInTheDocument();
});

test('the issue is not fetched for a NaN issueId — "Issue not found" renders instead', async () => {
  const { fetchMock } = renderSignals(<IssueDetailScreen issueId={Number('abc')} />, { fetchRoutes: [] });

  expect(await screen.findByText('Issue not found')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('(b) sym tab shows the original file path + context line text; raw toggle shows raw frames', async () => {
  renderSignals(<IssueDetailScreen issueId={1} />, {
    fetchRoutes: [issueRoute(), occurrencesRoute({ rows: [OCC_NEWEST], total: 1 }), sessionSymRoute],
  });

  expect(await screen.findByText('src/checkout/CartList.tsx:48')).toBeInTheDocument();
  expect(screen.getByText('const rows = cart.items.map((it) => toRow(it));')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'raw' }));

  expect(await screen.findByText(/index-8f3a91/)).toBeInTheDocument();
});

test('(c) a payload WITHOUT stackSymbolicated still renders the grouped view, with the no-sourcemaps banner and a raw toggle', async () => {
  const rawSession: SessionTimeline = {
    session: { ...SESSION_SYM.session, sessionId: 'sess_raw1', release: '1.44.1' },
    rows: [
      {
        ...SESSION_SYM.rows[0]!,
        id: 601,
        payload: {
          // Browser occurrence: source maps were expected here, so the
          // "no source maps" banner is relevant.
          platform: { runtime: 'browser' },
          stack: [
            { functionName: 't.map', file: '/assets/minified-chunk.js', line: 14, column: 20993, inApp: false },
          ],
          breadcrumbs: [],
        },
      },
    ],
  };

  renderSignals(<IssueDetailScreen issueId={1} />, {
    fetchRoutes: [
      issueRoute(),
      occurrencesRoute({ rows: [{ id: 601, receivedAt: '2026-07-22T14:03:35Z', release: '1.44.1', sessionId: 'sess_raw1' }], total: 1 }),
      { test: /\/signals-api\/sessions\/sess_raw1\/signals$/, handler: () => rawSession },
    ],
  });

  expect(await screen.findByText(/No source maps uploaded for release/)).toBeInTheDocument();
  expect(screen.getByText(/minified-chunk/)).toBeInTheDocument();
  // Unsymbolicated no longer means "flat raw list only": the grouped view is
  // still rendered (from the raw frames) and the toggle stays available so the
  // flat list is one click away.
  expect(screen.getByRole('tab', { name: 'symbolicated' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'raw' })).toBeInTheDocument();
});

test('(c2) an unsymbolicated NODE stack shows WHERE it happened: in-app frame with file:line, no tab switching', async () => {
  // The real-world case that motivated this: source maps are only ever uploaded
  // for browser bundles, so every api/mcp stack arrives unsymbolicated — but its
  // frames already carry true paths. Those must be visible on arrival.
  const nodeSession: SessionTimeline = {
    session: { ...SESSION_SYM.session, sessionId: 'sess_node1', release: null },
    rows: [
      {
        ...SESSION_SYM.rows[0]!,
        id: 602,
        payload: {
          // Node occurrence: source maps never apply, so the banner must be
          // suppressed even though these frames aren't symbolicated.
          platform: { runtime: 'node' },
          stack: [
            {
              functionName: 'buildValueRows',
              file: 'apps/api/src/values/build-value-rows.ts',
              line: 23,
              column: 11,
              inApp: true,
            },
            {
              functionName: 'processTicksAndRejections',
              file: 'node:internal/process/task_queues',
              line: 95,
              column: 5,
              inApp: false,
            },
          ],
          breadcrumbs: [],
        },
      },
    ],
  };

  renderSignals(<IssueDetailScreen issueId={1} />, {
    fetchRoutes: [
      issueRoute(),
      occurrencesRoute({
        rows: [{ id: 602, receivedAt: '2026-07-22T14:03:35Z', release: null, sessionId: 'sess_node1' }],
        total: 1,
      }),
      { test: /\/signals-api\/sessions\/sess_node1\/signals$/, handler: () => nodeSession },
    ],
  });

  expect(await screen.findByText('buildValueRows')).toBeInTheDocument();
  expect(screen.getByText('apps/api/src/values/build-value-rows.ts:23')).toBeInTheDocument();
  expect(screen.getByText('in-app')).toBeInTheDocument();
  // The misleading "no source maps" banner must NOT appear for a node stack.
  expect(screen.queryByText(/No source maps uploaded/)).not.toBeInTheDocument();
});

test('(d) breadcrumbs render glyph types and the 500 chip; the terminal row is the error itself, danger-styled', async () => {
  renderSignals(<IssueDetailScreen issueId={1} />, {
    fetchRoutes: [issueRoute(), occurrencesRoute({ rows: [OCC_NEWEST], total: 1 }), sessionSymRoute],
  });

  expect(await screen.findByText('cart hydrate: 3 items')).toBeInTheDocument();
  expect(screen.getByText('POST /api/coupon')).toBeInTheDocument();
  expect(screen.getByText('500')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'navigation' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'click' })).toBeInTheDocument();

  // The terminal row is synthesized from the matched error signal (name +
  // message + clientTimestamp), not from a breadcrumb — there is no
  // wire-legal 'error' breadcrumb type — and renders danger-styled.
  expect(screen.getByText('TypeError', { selector: 'span.text-danger' })).toBeInTheDocument();
  expect(
    screen.getByText("Cannot read properties of undefined (reading 'map')", { selector: 'span.text-danger' }),
  ).toBeInTheDocument();
});

test('the PLATFORM card shows an sdk chip shortened from the @bendela6/signals-* package name', async () => {
  renderSignals(<IssueDetailScreen issueId={1} />, {
    fetchRoutes: [issueRoute(), occurrencesRoute({ rows: [OCC_NEWEST], total: 1 }), sessionSymRoute],
  });

  expect(await screen.findByText(/browser 0\.1\.0/)).toBeInTheDocument();
});

test('(e) occurrences render and the session link points at /signals/sessions/sess_x', async () => {
  renderSignals(<IssueDetailScreen issueId={1} />, {
    fetchRoutes: [issueRoute(), occurrencesRoute({ rows: [OCC_NEWEST, OCC_OLDER], total: 2 }), sessionSymRoute],
  });

  const newestLink = await screen.findByRole('link', { name: /sess_9f3k21/ });
  expect(newestLink).toHaveAttribute('href', '/signals/sessions/sess_9f3k21');

  const olderLink = screen.getByRole('link', { name: /sess_2mq8ce/ });
  expect(olderLink).toHaveAttribute('href', '/signals/sessions/sess_2mq8ce');
});

test('(f) clicking Resolve PATCHes /signals-api/issues/1', async () => {
  let resolved = false;
  renderSignals(<IssueDetailScreen issueId={1} />, {
    fetchRoutes: [
      {
        test: /\/signals-api\/issues\/1$/,
        handler: (_url, init) => {
          if (init?.method === 'PATCH') {
            resolved = true;
            expect(JSON.parse(String(init.body))).toEqual({ status: 'resolved' });
            return { ...ISSUE, status: 'resolved' };
          }
          return ISSUE;
        },
      },
      occurrencesRoute({ rows: [], total: 0 }),
    ],
  });

  await screen.findByText('TypeError');
  fireEvent.click(screen.getByRole('button', { name: /Resolve/ }));

  await waitFor(() => expect(resolved).toBe(true));
});

test('(g) a 500-style ApiError shows "Couldn\'t load issue" + Retry, not "Issue not found"', async () => {
  renderSignals(<IssueDetailScreen issueId={1} />, {
    fetchRoutes: [
      {
        test: /\/signals-api\/issues\/1$/,
        handler: () => {
          // Mirrors what apps/web/src/api/client.ts's fetchJson actually
          // throws for a non-2xx response — a non-404 ApiError must NOT be
          // misclassified as "issue not found".
          throw new ApiError(500, 'internal error');
        },
      },
    ],
  });

  expect(await screen.findByText("Couldn't load issue")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  expect(screen.queryByText('Issue not found')).not.toBeInTheDocument();
});
