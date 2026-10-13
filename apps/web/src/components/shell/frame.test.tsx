import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board, Item, Project } from '../../api/types';
import { rootRoute } from '../../routes/root-route';

const createdAt = '2026-01-01T00:00:00.000Z';

function project(id: number, key: string, name: string, itemPrefix: string): Project {
  return {
    id,
    key,
    name,
    schemeId: 1,
    itemPrefix,
    createdAt,
    repositoryUrl: null,
    defaultBranch: null,
  };
}

function item(id: number, status: string, parentId: number | null = null): Item {
  return {
    id,
    number: id,
    key: `K-${id}`,
    typeId: 1,
    parentId,
    createdBy: 7,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
    values: { status, title: `Item ${id}` },
    comments: [],
    links: [],
  } as Item;
}

// A board with a workflow status, and the items given.
function board(of: Project, items: Item[]): Board {
  return {
    project: of,
    users: [],
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
    ],
    placements: [{ itemTypeId: 1, fieldId: 10, position: 1, required: true, configOverride: null }],
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
    ],
    transitions: [],
    linkTypes: [],
    targetTypes: [],
    views: [],
    childTypes: [],
    items,
  };
}

const TICKETS = project(1, 'tk', 'Tickets', 'TK');
const GATEWAY = project(2, 'gw', 'Gateway', 'GW');
const USERS = [
  { id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null },
  { id: 8, name: 'Build bot', email: null, kind: 'agent', archivedAt: null },
];
const BOARDS: Record<string, Board> = {
  tk: board(TICKETS, [item(1, 'backlog'), item(2, 'backlog'), item(3, 'backlog', 1)]),
  gw: board(GATEWAY, [item(4, 'backlog')]),
};

/**
 * Mounts the REAL root route, so the REAL frame and its sidebar, on a memory
 * history at `path`, over a page that says only where it is. The projects,
 * their boards and the users are the fixtures above; anything else reads as
 * an empty list.
 */
function renderFrame(path = '/') {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const boardKey = /^\/api\/projects\/([^/]+)\/board$/.exec(url)?.[1];
      const body =
        url === '/api/projects'
          ? { data: [TICKETS, GATEWAY] }
          : boardKey
            ? BOARDS[boardKey]
            : url.startsWith('/api/users')
              ? { data: USERS }
              : { data: [] };
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(body)) });
    }),
  );
  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: () => <p>page</p>,
  });
  const home = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <p>home</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([home, page]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const sidebar = () => screen.findByRole('complementary', { name: 'Navigation' });

/**
 * A sidebar row by its label, once it shows `count` at its end. The count
 * is part of the link's text, so the label alone is matched as its start.
 */
async function row(nav: HTMLElement, label: string, count?: string) {
  const link = await within(nav).findByRole('link', { name: new RegExp(`^${label}`) });
  if (count !== undefined) {
    expect(await within(link).findByText(count)).toBeInTheDocument();
  }
  return link;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('leads with Home, counting the projects, lit on the home page', async () => {
  renderFrame('/');
  const nav = await sidebar();
  const home = await row(nav, 'Home', '2');
  expect(home).toHaveAttribute('href', '/');
  expect(home).toHaveAttribute('aria-current', 'page');
});

test("counts every project's items on All items", async () => {
  renderFrame('/all');
  const nav = await sidebar();
  // Two in Tickets and one in Gateway: a subitem is counted under its parent, as the page does.
  const all = await row(nav, 'All items', '3');
  expect(all).toHaveAttribute('href', '/all');
  expect(all).toHaveAttribute('aria-current', 'page');
  expect(await row(nav, 'Home', '2')).not.toHaveAttribute('aria-current');
});

test('lists each project under Projects, with its own count, lit while inside it', async () => {
  renderFrame('/p/tk/v/1');
  const nav = await sidebar();
  expect(within(nav).getByRole('button', { name: /^Projects/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  // Two items; their subitem is not one of the board's rows.
  const tickets = await row(nav, 'Tickets', '2');
  expect(tickets).toHaveAttribute('href', '/p/tk');
  expect(tickets).toHaveAttribute('aria-current', 'page');
  const gateway = await row(nav, 'Gateway', '1');
  expect(gateway).toHaveAttribute('href', '/p/gw');
  expect(gateway).not.toHaveAttribute('aria-current');
});

test('"New project" on the Projects section opens the new project dialog', async () => {
  renderFrame('/');
  const nav = await sidebar();
  await userEvent.click(within(nav).getByRole('button', { name: 'New project' }));
  expect(await screen.findByRole('dialog', { name: 'New project' })).toBeInTheDocument();
});

test('links Schema under System, lit on the schema page', async () => {
  renderFrame('/schema');
  const nav = await sidebar();
  expect(within(nav).getByRole('button', { name: /^System/ })).toBeInTheDocument();
  const schema = await row(nav, 'Schema');
  expect(schema).toHaveAttribute('href', '/schema');
  expect(schema).toHaveAttribute('aria-current', 'page');
});

test('opens the settings of the project on screen', async () => {
  localStorage.setItem('tickets-last-project', 'tk');
  renderFrame('/p/gw/v/1');
  const settings = await row(await sidebar(), 'Settings');
  expect(settings).toHaveAttribute('href', '/p/gw/settings');
});

test("off a project, opens the last project's settings, or else the first's", async () => {
  localStorage.setItem('tickets-last-project', 'gw');
  renderFrame('/all');
  expect(await row(await sidebar(), 'Settings')).toHaveAttribute('href', '/p/gw/settings');
});

test("with no project opened yet, opens the first project's settings", async () => {
  renderFrame('/');
  expect(await row(await sidebar(), 'Settings')).toHaveAttribute('href', '/p/tk/settings');
});

test('lists the settings tabs under Settings, the one on screen lit', async () => {
  renderFrame('/p/gw/settings/fields');
  const nav = await sidebar();
  await row(nav, 'Settings');
  const tabs = ['Types', 'Fields', 'Workflow', 'Links', 'Repository'];
  for (const label of tabs) {
    expect(within(nav).getByRole('link', { name: label })).toHaveAttribute(
      'href',
      `/p/gw/settings/${label.toLowerCase()}`,
    );
  }
  expect(within(nav).getByRole('link', { name: 'Fields' })).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getByRole('link', { name: 'Types' })).not.toHaveAttribute('aria-current');
});

test('shows who is acting in the footer, and switches to someone else', async () => {
  localStorage.setItem('tickets-user-id', '7');
  renderFrame('/');
  const nav = await sidebar();
  await userEvent.click(await within(nav).findByRole('button', { name: /Mara K/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: /Build bot/ }));
  expect(await within(nav).findByRole('button', { name: /Build bot/ })).toBeInTheDocument();
  expect(localStorage.getItem('tickets-user-id')).toBe('8');
});

test("picks the theme in the footer, and remembers it under tickets' key", async () => {
  renderFrame('/');
  const nav = await sidebar();
  const theme = within(nav).getByRole('radiogroup', { name: 'Theme' });
  const other = document.documentElement.dataset.theme === 'dark' ? 'Light' : 'Dark';
  await userEvent.click(within(theme).getByRole('radio', { name: other }));
  expect(document.documentElement.dataset.theme).toBe(other.toLowerCase());
  expect(localStorage.getItem('tickets-theme')).toBe(other.toLowerCase());
});

test("at rail width, the footer keeps the user's avatar and one theme switch", async () => {
  localStorage.setItem('tickets-user-id', '7');
  localStorage.setItem('tickets-nav:collapsed', 'true');
  renderFrame('/');
  const nav = await sidebar();
  expect(await within(nav).findByRole('button', { name: 'Acting as Mara K' })).toBeInTheDocument();
  expect(
    within(nav).getByRole('button', { name: /^Switch to the (light|dark) theme$/ }),
  ).toBeInTheDocument();
});
