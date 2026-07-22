import { screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ApiError } from '../../api/api-error';
import type { SessionTimeline } from '../../api/signals/signals-api';
import { SessionScreen } from './session-screen';
import { renderSignals, type FetchRoute } from './test-utils';

afterEach(() => vi.unstubAllGlobals());

// One event, one log, a 35s idle gap, then a terminal error with an issueKey
// — the canned "full flow" timeline the brief's scenarios (a)-(d) exercise.
const SESSION: SessionTimeline = {
  session: {
    sessionId: 'sess_9f3k21',
    appId: 1,
    startedAt: '2026-07-22T14:00:00Z',
    endedAt: '2026-07-22T14:00:45Z',
    durationMs: 45_000,
    crashed: true,
    counts: { error: 1, log: 1, event: 1 },
    release: '1.44.1',
    platform: { runtime: 'browser', browser: 'Chrome 126', os: 'macOS 14.5' },
  },
  rows: [
    {
      id: 1,
      kind: 'event',
      name: 'page load',
      message: '/home',
      mechanism: null,
      level: 'info',
      clientTimestamp: '2026-07-22T14:00:00Z',
      issueId: null,
      issueKey: null,
      payload: { user: { id: 'usr_29c1' } },
    },
    {
      id: 2,
      kind: 'log',
      name: 'console',
      message: 'app boot in 1.2s',
      mechanism: null,
      level: 'info',
      clientTimestamp: '2026-07-22T14:00:10Z',
      issueId: null,
      issueKey: null,
      payload: {},
    },
    {
      id: 3,
      kind: 'error',
      name: 'TypeError',
      message: "Cannot read properties of undefined (reading 'map')",
      mechanism: 'uncaught-exception',
      level: 'error',
      clientTimestamp: '2026-07-22T14:00:45Z',
      issueId: 7,
      issueKey: 'SGL-142',
      payload: {
        stackSymbolicated: [
          { functionName: 'CartList', file: 'src/checkout/CartList.tsx', line: 48, column: 21, inApp: true },
        ],
      },
    },
  ],
};

const sessionRoute: FetchRoute = {
  test: /\/signals-api\/sessions\/sess_9f3k21\/signals$/,
  handler: () => SESSION,
};

test('(a) rows render in order with elapsed-gutter values', async () => {
  renderSignals(<SessionScreen sessionId="sess_9f3k21" />, { fetchRoutes: [sessionRoute] });

  expect(await screen.findByText('t+0.0s')).toBeInTheDocument();
  expect(screen.getByText('t+10.0s')).toBeInTheDocument();
  expect(screen.getByText('t+45.0s')).toBeInTheDocument();
  expect(screen.getByText('page load — /home')).toBeInTheDocument();
  expect(screen.getByText('app boot in 1.2s')).toBeInTheDocument();
});

test('(b) a gap over 30s between rows compresses to a dashed idle pill', async () => {
  renderSignals(<SessionScreen sessionId="sess_9f3k21" />, { fetchRoutes: [sessionRoute] });

  expect(await screen.findByText('35s idle')).toBeInTheDocument();
});

test('(c) the error card links to the issue route', async () => {
  renderSignals(<SessionScreen sessionId="sess_9f3k21" />, { fetchRoutes: [sessionRoute] });

  const link = await screen.findByRole('link', { name: /View issue SGL-142/ });
  expect(link).toHaveAttribute('href', '/signals/issues/7');
  expect(screen.getByText('‹ Issues')).toBeInTheDocument();
  const breadcrumbIssueLink = screen.getByRole('link', { name: 'SGL-142' });
  expect(breadcrumbIssueLink).toHaveAttribute('href', '/signals/issues/7');
});

test('(d) crashed chip + duration render in the header/stats', async () => {
  renderSignals(<SessionScreen sessionId="sess_9f3k21" />, { fetchRoutes: [sessionRoute] });

  expect(await screen.findByText('crashed')).toBeInTheDocument();
  expect(screen.getByText('45s')).toBeInTheDocument();
  expect(screen.getByText('sess_9f3k21')).toBeInTheDocument();
});

test('(e) a 404 ApiError shows "Session not found", not a generic error', async () => {
  renderSignals(<SessionScreen sessionId="sess_nope" />, {
    fetchRoutes: [
      {
        test: /\/signals-api\/sessions\/sess_nope\/signals$/,
        handler: () => {
          throw new ApiError(404, 'session not found');
        },
      },
    ],
  });

  expect(await screen.findByText('Session not found')).toBeInTheDocument();
  expect(screen.queryByText("Couldn't load session")).not.toBeInTheDocument();
});

test('a non-404 ApiError shows "Couldn\'t load session" + Retry, not "Session not found"', async () => {
  renderSignals(<SessionScreen sessionId="sess_9f3k21" />, {
    fetchRoutes: [
      {
        test: /\/signals-api\/sessions\/sess_9f3k21\/signals$/,
        handler: () => {
          throw new ApiError(500, 'internal error');
        },
      },
    ],
  });

  expect(await screen.findByText("Couldn't load session")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  expect(screen.queryByText('Session not found')).not.toBeInTheDocument();
});
