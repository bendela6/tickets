import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SignalsPanel } from './signals-panel';

afterEach(() => vi.unstubAllGlobals());

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({ rows: [], total: 6 })),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPanel(initialPath = '/signals') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rootRoute = createRootRoute({ component: () => <SignalsPanel /> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test('renders Issues and Apps nav links, and the open-issues count once loaded', async () => {
  stubFetch();
  renderPanel();

  expect(await screen.findByRole('link', { name: /Issues/ })).toHaveAttribute('href', '/signals');
  expect(screen.getByRole('link', { name: /Apps/ })).toHaveAttribute('href', '/signals/apps');

  await waitFor(() => expect(screen.getByText('6')).toBeInTheDocument());
});

test('does not render a count while the open-issues query is loading', async () => {
  // A fetch that never resolves keeps the query in a perpetual loading state.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  renderPanel();

  const issuesLink = await screen.findByRole('link', { name: /Issues/ });
  expect(issuesLink.textContent).toBe('Issues');
});
