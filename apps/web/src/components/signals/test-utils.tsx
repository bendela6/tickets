import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

/**
 * One entry in the canned-`fetch` router table: the first route whose `test`
 * regex matches the request URL handles it. `handler` returns the JSON body
 * for a 200 response (sync or async), or throws/rejects to simulate a
 * network failure — same shape `fetchJson`'s callers see when the signals
 * daemon is down.
 */
export type FetchRoute = {
  test: RegExp;
  handler: (url: string, init?: RequestInit) => unknown | Promise<unknown>;
};

function stubFetchRoutes(routes: FetchRoute[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const route = routes.find((candidate) => candidate.test.test(url));
    if (!route) {
      throw new Error(`renderSignals: no fetchRoutes entry matches ${init?.method ?? 'GET'} ${url}`);
    }
    const body = await route.handler(url, init);
    return { ok: true, text: () => Promise.resolve(JSON.stringify(body)) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Shared render harness for Signals screen tests (Tasks 4-7): a fresh
 * QueryClient (retries off, so a rejected fetch surfaces as an error state
 * immediately instead of retry-looping), a memory-history router so
 * `Link`/`useNavigate` render real hrefs without touching the app's real
 * route tree, and `globalThis.fetch` stubbed from a small { test, handler }
 * table. Callers must `afterEach(() => vi.unstubAllGlobals())` themselves
 * (matching `signals-panel.test.tsx`'s convention) since that's a per-file
 * concern, not something this helper can clean up on their behalf.
 */
export function renderSignals(
  ui: ReactNode,
  { fetchRoutes, initialPath = '/signals' }: { fetchRoutes: FetchRoute[]; initialPath?: string },
) {
  const fetchMock = stubFetchRoutes(fetchRoutes);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rootRoute = createRootRoute({ component: () => <>{ui}</> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  // `router` is exposed so callers can assert a click/action navigated
  // somewhere (e.g. `router.state.location.pathname`) even when the target
  // is reached via `useNavigate()` rather than a `Link` with an inspectable
  // `href` — the memory router still tracks the location even though this
  // test root has no child routes registered to render at that path.
  return { ...result, fetchMock, queryClient, router };
}
