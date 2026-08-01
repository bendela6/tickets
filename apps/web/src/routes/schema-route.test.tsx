import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SchemaGraph } from '../components/schema/erd-types';
import { rootRoute } from './root-route';
import { schemaRoute } from './schema-route';

// EerDiagram's load() schedules a double-rAF fit (see diagram-provider.tsx).
// jsdom's rAF support is version-dependent; the eer module's own tests
// (eer-viewer.test.tsx) stub it the same defensive way.
beforeAll(() => {
  globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
});

// Two tables with an fk between them: 'comments.ticket_id' -> 'tickets.id'.
// A single-table graph would render a card but never exercise edge rendering
// at all — this fixture stays the minimal shape that proves both a card AND
// a derived fk edge reach the DOM.
const graph: SchemaGraph = {
  groups: [
    { key: 'records', label: 'Ticket data', color: 'orange', tables: ['comments', 'tickets'] },
  ],
  tables: [
    {
      name: 'tickets',
      schema: null,
      group: 'records',
      primaryKey: ['id'],
      uniques: [],
      columns: [{ name: 'id', type: 'serial', notNull: true, pk: true, fk: null }],
    },
    {
      name: 'comments',
      schema: null,
      group: 'records',
      primaryKey: ['id'],
      uniques: [],
      columns: [
        { name: 'id', type: 'serial', notNull: true, pk: true, fk: null },
        {
          name: 'ticket_id',
          type: 'integer',
          notNull: true,
          pk: false,
          fk: { schema: null, table: 'tickets', column: 'id' },
        },
      ],
    },
  ],
  enums: [],
};

const emptyGraph: SchemaGraph = { groups: [], tables: [], enums: [] };

// The same graph minus `tickets`, so comments.ticket_id points at a table that
// is not there. deriveRelationships skips the fk and loadModel only WARNS, so
// this is the shape where an edge goes missing with nothing on screen to say
// why — the case the warnings banner exists for.
const danglingFkGraph: SchemaGraph = {
  ...graph,
  tables: graph.tables.filter((t) => t.name !== 'tickets'),
};

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
    // By its aria-label, not its text. The outline below it lists a table
    // ALSO called `tickets`, so `name: 'tickets'` matches that row instead and
    // the assertion passes without the dropdown existing at all.
    expect(await screen.findByRole('button', { name: 'Database: tickets' })).toBeInTheDocument();
  });

  it('renders the outline in the mode panel, under the database picker', async () => {
    // The groups → tables tree lives in the shell's left panel, which only
    // works because schemaRoute wraps the WHOLE shell in the diagram provider.
    // Rendered inside <main> instead, none of this would be here.
    renderSchemaRoute();
    const panel = (await screen.findByText('SCHEMA')).closest('div')!.parentElement!;
    expect(
      await within(panel).findByRole('textbox', { name: 'Filter tables' }),
    ).toBeInTheDocument();
    expect(
      await within(panel).findByRole('button', { name: 'Ticket data, 2 tables' }),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'comments' })).toBeInTheDocument();
    // Proves `panel` really is the panel and not some ancestor of the whole
    // page: the canvas toolbar sits in <main>, outside it.
    expect(within(panel).queryByRole('button', { name: 'Fit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit' })).toBeInTheDocument();
  });

  it('filters the outline without touching what the canvas draws', async () => {
    const { container } = renderSchemaRoute();
    await waitFor(() => expect(container.querySelectorAll('[data-card]')).toHaveLength(2));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Filter tables' }), {
      target: { value: 'comments' },
    });
    expect(screen.queryByRole('button', { name: 'tickets' })).not.toBeInTheDocument();
    // The filter is a table of contents, not a canvas filter — both cards stay.
    expect(container.querySelectorAll('[data-card]')).toHaveLength(2);
  });

  it('renders the diagram beside the shell', async () => {
    const { container } = renderSchemaRoute();
    // Both tables from the stubbed graph land as eer entity cards.
    await waitFor(() => expect(container.querySelectorAll('[data-card]')).toHaveLength(2));
    const commentsCard = container.querySelector('[data-entity="comments"]');
    expect(commentsCard?.textContent).toContain('comments');
    // The fk (comments.ticket_id -> tickets.id) is a derived relationship,
    // drawn as an SVG path inside eer's edges layer — not just "a table".
    const edgesLayer = container.querySelector('svg[data-edges]');
    expect(edgesLayer?.querySelectorAll('g[data-rel]')).toHaveLength(1);
    expect(edgesLayer?.querySelector('path[data-path]')).not.toBeNull();
  });

  it('reads the selected database from the search param', async () => {
    renderSchemaRoute({ path: '/schema?database=postgres' });
    await screen.findByLabelText('Schema');
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/schema?database=postgres',
        expect.anything(),
      ),
    );
    expect(await screen.findByRole('button', { name: 'Database: postgres' })).toBeInTheDocument();
  });

  it('says so when the chosen database has no tables, instead of a blank pane', async () => {
    // `postgres` is offered by the dropdown and has zero user tables. Before
    // the fix this crashed the renderer out of useEffect and the error
    // boundary swallowed the whole app; a blank pane would be only marginally
    // better, so the empty case is stated.
    renderSchemaRoute({ schema: emptyGraph, path: '/schema?database=postgres' });
    expect(await screen.findByText('No tables in this database.')).toBeInTheDocument();
    // ...and ONLY that. loadModel reports empty groups/entities as a load
    // error, so the error branch and the empty branch both fired and a red
    // "could not be drawn" stacked above the real explanation.
    expect(screen.queryByText('This schema could not be drawn.')).not.toBeInTheDocument();
    // The shell survives: the crash used to take the rail with it.
    expect(screen.getByLabelText('Schema')).toBeInTheDocument();
  });

  it('says why an edge is missing instead of just not drawing it', async () => {
    const { container } = renderSchemaRoute({ schema: danglingFkGraph });
    // The card still renders — this is a partial failure, not a broken schema.
    await waitFor(() => expect(container.querySelectorAll('[data-card]')).toHaveLength(1));
    expect(container.querySelectorAll('g[data-rel]')).toHaveLength(0);
    expect(screen.getByText('1 part of this schema could not be drawn')).toBeInTheDocument();
    expect(screen.getByText(/unknown table "tickets"/)).toBeInTheDocument();
  });

  it('shows no warnings banner for a schema that draws completely', async () => {
    const { container } = renderSchemaRoute();
    await waitFor(() => expect(container.querySelectorAll('[data-card]')).toHaveLength(2));
    expect(screen.queryByText(/could not be drawn/)).not.toBeInTheDocument();
  });
});

describe('schemaRoute search params', () => {
  const validate = schemaRoute.options.validateSearch as (s: Record<string, unknown>) => {
    database?: string;
  };

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
