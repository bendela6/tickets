import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SchemaGraph } from '../components/schema/erd-types';
import { rootRoute } from './root-route';
import { schemaRoute } from './schema-route';

const graph: SchemaGraph = {
  groups: [{ key: 'records', label: 'Ticket data', color: 'orange', tables: ['comments'] }],
  tables: [
    {
      name: 'comments',
      schema: null,
      group: 'records',
      primaryKey: ['id'],
      uniques: [],
      columns: [{ name: 'id', type: 'serial', notNull: true, pk: true, fk: null }],
    },
  ],
  enums: [],
};

const emptyGraph: SchemaGraph = { groups: [], tables: [], enums: [] };

/**
 * Mounts the REAL route object against the REAL root route, on a memory
 * history at /schema. Rendering `SchemaPage` on its own would prove nothing
 * here: the thing under test is that navigating to /schema mounts the shell,
 * which is a property of the route tree plus the component together. The root
 * route supplies CurrentUserProvider/ToastProvider; only the query client and
 * `fetch` have to be stood up.
 */
function renderSchemaRoute({
  schema = graph,
  path = '/schema',
}: { schema?: SchemaGraph; path?: string } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const body = url.startsWith('/api/schema/databases')
        ? { databases: ['tickets', 'postgres'], current: 'tickets' }
        : url.startsWith('/api/schema')
          ? schema
          : url.startsWith('/api/users')
            ? { data: [] }
            : null;
      if (body === null) throw new Error(`unexpected fetch: ${url}`);
      return { ok: true, text: () => Promise.resolve(JSON.stringify(body)) } as Response;
    }),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree: rootRoute.addChildren([schemaRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('/schema inside the app shell', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mounts the activity rail, so the route is reachable from every other mode', async () => {
    // The regression this pins: schemaRoute rendered a bare full-height div
    // and was never wrapped in AppShell. The rail and mode panel did not mount
    // at all, so `modeForPath`'s 'schema' branch was unreachable in the real
    // app and SchemaPanel was dead code.
    renderSchemaRoute();
    expect(await screen.findByLabelText('Schema')).toBeInTheDocument();
    expect(screen.getByLabelText('Tasks')).toBeInTheDocument();
    expect(screen.getByLabelText('Signals')).toBeInTheDocument();
  });

  it('shows the schema mode panel with its database dropdown', async () => {
    // Not just "a panel": the SCHEMA panel. This is what proves modeForPath
    // resolved 'schema' and ModePanel took that branch.
    renderSchemaRoute();
    expect(await screen.findByText('SCHEMA')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'tickets' })).toBeInTheDocument();
  });

  it('renders the diagram beside the shell', async () => {
    const { container } = renderSchemaRoute();
    await waitFor(() => expect(container.querySelectorAll('.erd-card')).toHaveLength(1));
    expect(container.querySelector('.erd-card-title')?.textContent).toBe('comments');
  });

  it('reads the selected database from the search param', async () => {
    renderSchemaRoute({ path: '/schema?database=postgres' });
    await screen.findByLabelText('Schema');
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/schema?database=postgres', expect.anything()),
    );
    expect(await screen.findByRole('button', { name: 'postgres' })).toBeInTheDocument();
  });

  it('says so when the chosen database has no tables, instead of a blank pane', async () => {
    // `postgres` is offered by the dropdown and has zero user tables. Before
    // the fix this crashed the renderer out of useEffect and the error
    // boundary swallowed the whole app; a blank pane would be only marginally
    // better, so the empty case is stated.
    renderSchemaRoute({ schema: emptyGraph, path: '/schema?database=postgres' });
    expect(await screen.findByText('No tables in this database.')).toBeInTheDocument();
    // The shell survives: the crash used to take the rail with it.
    expect(screen.getByLabelText('Schema')).toBeInTheDocument();
  });
});

describe('schemaRoute search params', () => {
  const validate = schemaRoute.options.validateSearch as (
    s: Record<string, unknown>,
  ) => { database?: string };

  it('keeps a database name', () => {
    expect(validate({ database: 'tickets_dev' })).toEqual({ database: 'tickets_dev' });
  });

  it('drops an empty database name', () => {
    expect(validate({ database: '' })).toEqual({});
  });

  it('drops a non-string database', () => {
    expect(validate({ database: 42 })).toEqual({});
  });

  it('drops unrelated params', () => {
    expect(validate({ other: 'x' })).toEqual({});
  });
});
