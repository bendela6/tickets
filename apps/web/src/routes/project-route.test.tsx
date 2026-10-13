import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board, Item } from '../api/types';
import { projectIndexRoute } from './project-index-route';
import { projectRoute } from './project-route';
import { rootRoute } from './root-route';
import { ticketPageRoute } from './ticket-page-route';
import { viewRoute } from './view-route';

const createdAt = '2026-01-01T00:00:00.000Z';

function item(id: number, key: string, status: string, title: string): Item {
  return {
    id,
    number: id,
    key,
    typeId: 1,
    parentId: null,
    createdBy: 7,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
    values: { status, title },
    comments: [],
    links: [],
  } as Item;
}

// One type with a workflow status, two views, and two items, one of them done.
function makeBoard(): Board {
  return {
    project: {
      id: 1,
      key: 'core',
      name: 'Items Core',
      schemeId: 1,
      itemPrefix: 'CORE',
      createdAt,
      repositoryUrl: null,
      defaultBranch: null,
    },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types: [
      { id: 1, schemeId: 1, key: 'task', label: 'Task', position: 1, config: {}, archivedAt: null },
    ],
    fields: [
      {
        id: 10,
        schemeId: 1,
        key: 'status',
        label: 'Status',
        type: 'option',
        config: { workflow: true },
        optionSetId: 100,
        archivedAt: null,
      },
      {
        id: 11,
        schemeId: 1,
        key: 'title',
        label: 'Title',
        type: 'string',
        config: {},
        optionSetId: null,
        archivedAt: null,
      },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 11, position: 1, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 10, position: 2, required: true, configOverride: null },
    ],
    options: [
      {
        id: 1000,
        optionSetId: 100,
        value: 'backlog',
        label: 'Backlog',
        position: 1,
        kind: 'todo',
        config: {},
        archivedAt: null,
      },
      {
        id: 1001,
        optionSetId: 100,
        value: 'done',
        label: 'Done',
        position: 2,
        kind: 'done',
        config: {},
        archivedAt: null,
      },
    ],
    transitions: [],
    linkTypes: [],
    targetTypes: [],
    views: [
      { id: 1, projectId: 1, name: 'All work', config: {} },
      { id: 2, projectId: 1, name: 'Mine', config: {} },
    ],
    childTypes: [],
    items: [
      item(100, 'CORE-1', 'backlog', 'Fix login redirect'),
      item(101, 'CORE-2', 'done', 'Polish row hover'),
    ],
  };
}

/**
 * Mounts the REAL project routes under the REAL root route, on a memory
 * history: the page's header, its view tabs and what is lit are the route
 * tree's, so it is the tree that is under test. The board answers its own
 * address; everything else the frame or a panel reads gets an empty list.
 */
function renderProject(path: string) {
  const board = makeBoard();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const body = url === '/api/projects/core/board' ? board : { data: [] };
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(body)) });
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      projectRoute.addChildren([projectIndexRoute, viewRoute, ticketPageRoute]),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('heads the page with the project: its name, the way back, and how far along it is', async () => {
  renderProject('/p/core/v/1');
  expect(await screen.findByRole('heading', { level: 1, name: 'Items Core' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/');
  expect(screen.getByText('CORE · 2 items · 50% done')).toBeInTheDocument();
  // One h1 on the page: the view's own row of controls has no title of its own.
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});

test('lists the views as tabs and lights the one on screen', async () => {
  const router = renderProject('/p/core/v/1');
  const views = await screen.findByRole('group', { name: 'Views' });
  expect(within(views).getByRole('button', { name: 'All work' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(within(views).getByRole('button', { name: 'Mine' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await userEvent.click(within(views).getByRole('button', { name: 'Mine' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/p/core/v/2'));
  expect(within(views).getByRole('button', { name: 'Mine' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test("lights no view on an item's page", async () => {
  renderProject('/p/core/t/CORE-1');
  const views = await screen.findByRole('group', { name: 'Views' });
  for (const tab of within(views).getAllByRole('button')) {
    expect(tab).toHaveAttribute('aria-pressed', 'false');
  }
});

test('"New view" after the tabs asks for the view\'s name', async () => {
  // Someone to name it as: without a user the field is disabled.
  localStorage.setItem('tickets-user-id', '7');
  renderProject('/p/core/v/1');
  await userEvent.click(await screen.findByRole('button', { name: 'New view' }));
  expect(screen.getByRole('textbox', { name: 'New view name' })).toHaveFocus();
  // It is not one of the tabs.
  const views = screen.getByRole('group', { name: 'Views' });
  expect(within(views).queryByRole('button', { name: 'New view' })).not.toBeInTheDocument();
});

test('"New item" in the header opens the new item dialog', async () => {
  renderProject('/p/core/v/1');
  await userEvent.click(await screen.findByRole('button', { name: 'New item' }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
