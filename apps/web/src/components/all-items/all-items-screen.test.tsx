import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board, Field, ItemType, Option } from '../../api/types';
import { CurrentUserProvider } from '../../state/current-user-context';
import { ToastProvider } from '@tickets/ui';
import { AllItemsScreen } from './all-items-screen';

const createdAt = '2026-01-01T00:00:00.000Z';

function field(
  id: number,
  schemeId: number,
  key: string,
  label: string,
  type: Field['type'],
  optionSetId: number | null = null,
  config: Field['config'] = {},
): Field {
  return { id, schemeId, key, label, type, config, optionSetId, archivedAt: null };
}

function taskType(id: number, schemeId: number): ItemType {
  return { id, schemeId, key: 'task', label: 'Task', position: 1, config: {}, archivedAt: null };
}

const workflowOptions = (base: number, optionSetId: number): Option[] => [
  { id: base, optionSetId, value: 'backlog', label: 'Backlog', position: 1, kind: 'todo', config: {}, archivedAt: null },
  { id: base + 1, optionSetId, value: 'doing', label: 'Doing', position: 2, kind: 'active', config: {}, archivedAt: null },
];

const severityOptions = (base: number, optionSetId: number): Option[] => [
  { id: base, optionSetId, value: 'sev1', label: 'Sev 1', position: 1, kind: null, config: { color: '#a03028' }, archivedAt: null },
  { id: base + 1, optionSetId, value: 'sev2', label: 'Sev 2', position: 2, kind: null, config: { color: '#a44e14' }, archivedAt: null },
];

// Two projects with different prefixes; 'severity' (option) is shared —
// same key + type + shape in both — while 'flavor' exists only in Items Core.
function makeCoreBoard(): Board {
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 1, itemPrefix: 'CORE', createdAt },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types: [taskType(1, 1)],
    fields: [
      field(10, 1, 'status', 'Status', 'option', 100, { workflow: true }),
      field(11, 1, 'title', 'Title', 'string'),
      field(12, 1, 'severity', 'Severity', 'option', 101),
      field(13, 1, 'flavor', 'Flavor', 'string'),
    ],
    placements: [
      { itemTypeId: 1, fieldId: 11, position: 1, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 10, position: 2, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 12, position: 3, required: false, configOverride: null },
    ],
    options: [...workflowOptions(1000, 100), ...severityOptions(1, 101)],
    transitions: [],
    linkTypes: [],
    targetTypes: [],
    views: [],
    childTypes: [],
    items: [
      {
        id: 100,
        number: 1,
        typeId: 1,
        parentId: null,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { status: 'backlog', title: 'Fix login redirect', severity: 'sev1' },
        comments: [],
        links: [],
      },
      {
        id: 101,
        number: 2,
        typeId: 1,
        parentId: null,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { status: 'doing', title: 'Polish table row hover', severity: 'sev2' },
        comments: [],
        links: [],
      },
      // subtask: must not appear as a top-level row
      {
        id: 102,
        number: 3,
        typeId: 1,
        parentId: 100,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { status: 'backlog', title: 'Subtask of the redirect fix' },
        comments: [],
        links: [],
      },
    ],
  };
}

function makeAppBoard(): Board {
  return {
    project: { id: 2, key: 'app', name: 'Items App', schemeId: 2, itemPrefix: 'APP', createdAt },
    users: [{ id: 9, name: 'Jae R', email: null, kind: 'human', archivedAt: null }],
    types: [taskType(5, 2)],
    fields: [
      field(20, 2, 'status', 'Status', 'option', 200, { workflow: true }),
      field(21, 2, 'title', 'Title', 'string'),
      field(22, 2, 'severity', 'Severity', 'option', 201),
    ],
    placements: [
      { itemTypeId: 5, fieldId: 21, position: 1, required: true, configOverride: null },
      { itemTypeId: 5, fieldId: 20, position: 2, required: true, configOverride: null },
      { itemTypeId: 5, fieldId: 22, position: 3, required: false, configOverride: null },
    ],
    options: [
      { id: 2000, optionSetId: 200, value: 'todo', label: 'To do', position: 1, kind: 'todo', config: {}, archivedAt: null },
      ...severityOptions(5, 201),
    ],
    transitions: [],
    linkTypes: [],
    targetTypes: [],
    views: [],
    childTypes: [],
    items: [
      {
        id: 200,
        number: 1,
        typeId: 5,
        parentId: null,
        createdBy: 9,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { status: 'todo', title: 'Ship mobile nav', severity: 'sev2' },
        comments: [],
        links: [],
      },
    ],
  };
}

function stubFetch(core: Board, app: Board) {
  const respond = (body: unknown) =>
    Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(body)) });
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/projects') {
      return respond({ data: [core.project, app.project] });
    }
    if (url === '/api/projects/core/board') {
      return respond(core);
    }
    if (url === '/api/projects/app/board') {
      return respond(app);
    }
    if (init?.method === 'PATCH' && url.startsWith('/api/items/')) {
      return respond({ id: Number(url.slice('/api/items/'.length)), updatedAt: 'later' });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: `no handler for ${url}`,
      text: () => Promise.resolve(''),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderScreen() {
  stubFetch(makeCoreBoard(), makeAppBoard());
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // The drawer's ItemDetail uses router links, so mount inside a memory router.
  const rootRoute = createRootRoute({ component: () => <AllItemsScreen /> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <QueryClientProvider client={client}>
      <CurrentUserProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </CurrentUserProvider>
    </QueryClientProvider>,
  );
  // wait until both boards have loaded and grouped
  await screen.findByText('Items Core');
  await screen.findByText('Items App');
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('groups rows under both project headers', async () => {
  await renderScreen();
  // group headers: prefix chip + project name
  expect(screen.getByText('Items Core')).toBeInTheDocument();
  expect(screen.getByText('Items App')).toBeInTheDocument();
  // rows from both boards, keyed with each project's own prefix
  expect(screen.getByText('CORE-1')).toBeInTheDocument();
  expect(screen.getByText('CORE-2')).toBeInTheDocument();
  expect(screen.getByText('APP-1')).toBeInTheDocument();
  // subtasks are not top-level rows
  expect(screen.queryByText('Subtask of the redirect fix')).not.toBeInTheDocument();
  // header meta counts top-level items and loaded projects
  expect(screen.getByText('3 items · 2 projects')).toBeInTheDocument();
  expect(screen.getByText('3 of 3 match filters')).toBeInTheDocument();
});

test('columns popover offers shared fields and disables unshared ones', async () => {
  await renderScreen();
  await userEvent.click(screen.getByRole('button', { name: '▦ Columns' }));
  expect(await screen.findByText('Shared across 2 projects')).toBeInTheDocument();
  // shared field is a real checkbox
  expect(screen.getByRole('checkbox', { name: 'Severity' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Severity' })).toBeChecked();
  // unshared field is listed but not toggleable, with its coverage
  expect(screen.getByText('Not shared — unavailable here')).toBeInTheDocument();
  expect(screen.getByText('Flavor')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Flavor' })).not.toBeInTheDocument();
  expect(screen.getByText('1 of 2')).toBeInTheDocument();
});

test('filtering by a shared field narrows rows across projects', async () => {
  await renderScreen();
  await userEvent.click(screen.getByRole('button', { name: '＋ Filter' }));
  await userEvent.click(screen.getByRole('button', { name: /Field…/ }));
  await userEvent.click(await screen.findByRole('option', { name: 'Severity' }));
  await userEvent.click(screen.getByRole('button', { name: 'Values…' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Sev 1' }));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(screen.getByText('1 of 3 match filters')).toBeInTheDocument());
  expect(screen.getByText('CORE-1')).toBeInTheDocument();
  expect(screen.queryByText('CORE-2')).not.toBeInTheDocument();
  expect(screen.queryByText('APP-1')).not.toBeInTheDocument();
  // the app project group disappears with its last row
  expect(screen.queryByText('Items App')).not.toBeInTheDocument();
});

test('inline status edit PATCHes /api/items/:id with a commandId envelope', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const fetchMock = stubFetch(makeCoreBoard(), makeAppBoard());
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rootRoute = createRootRoute({ component: () => <AllItemsScreen /> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <QueryClientProvider client={client}>
      <CurrentUserProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </CurrentUserProvider>
    </QueryClientProvider>,
  );
  await screen.findByText('CORE-1');
  await userEvent.click(screen.getByRole('button', { name: 'Backlog' }));
  await userEvent.click(await screen.findByRole('option', { name: /doing/i }));

  await waitFor(() => {
    const patchCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input) === '/api/items/100' && (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
  });
  const patchCall = fetchMock.mock.calls.find(
    ([input, init]) =>
      String(input) === '/api/items/100' && (init as RequestInit | undefined)?.method === 'PATCH',
  )!;
  const init = patchCall[1] as RequestInit;
  // the mutation envelope carries a random commandId — destructure it out
  // before comparing the rest of the PATCH body.
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(rest).toEqual({
    actorId: 7,
    expectedUpdatedAt: createdAt,
    values: { status: 'doing' },
  });
});

test('clicking a row opens the ticket drawer with that project’s board', async () => {
  await renderScreen();
  fireEvent.click(screen.getByText('Ship mobile nav'));
  const drawer = await screen.findByRole('complementary', { name: 'Item detail' });
  expect(within(drawer).getByText('APP-1')).toBeInTheDocument();
  expect(within(drawer).getByRole('button', { name: /ship mobile nav/i })).toBeInTheDocument();
});

/** Item keys in DOM order, read off the rendered data rows. Group banners
 *  carry no key, so this is exactly the row sequence the user sees. */
function keyOrder(): string[] {
  return [...document.querySelectorAll('[role="row"][data-index]')]
    .map((row) => /(?:CORE|APP)-\d+/.exec(row.textContent ?? '')?.[0])
    .filter((key): key is string => key !== undefined);
}

test('clicking a column header sorts rows inside each group', async () => {
  await renderScreen();
  // default ordering is by item number, ascending, within each project group
  expect(keyOrder()).toEqual(['CORE-1', 'CORE-2', 'APP-1']);

  const keyHeader = screen.getByRole('button', { name: 'Key' });
  await userEvent.click(keyHeader); // first click: ascending — unchanged
  expect(keyOrder()).toEqual(['CORE-1', 'CORE-2', 'APP-1']);

  await userEvent.click(keyHeader); // second click: descending
  // The sort reorders WITHIN each group; grouping still puts Core before App,
  // so APP-1 stays last rather than leading a globally descending list.
  expect(keyOrder()).toEqual(['CORE-2', 'CORE-1', 'APP-1']);

  await userEvent.click(keyHeader); // third click: back to no sort
  expect(keyOrder()).toEqual(['CORE-1', 'CORE-2', 'APP-1']);
});

test('a sorted column header announces its direction', async () => {
  await renderScreen();
  const header = () => screen.getByRole('columnheader', { name: /Key/ });
  expect(header()).toHaveAttribute('aria-sort', 'none');
  await userEvent.click(screen.getByRole('button', { name: 'Key' }));
  expect(header()).toHaveAttribute('aria-sort', 'ascending');
  await userEvent.click(screen.getByRole('button', { name: 'Key' }));
  expect(header()).toHaveAttribute('aria-sort', 'descending');
});
