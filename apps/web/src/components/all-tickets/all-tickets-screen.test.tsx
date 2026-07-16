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
import type { Board, Field, Status, TicketType } from '../../api/types';
import { CurrentUserProvider } from '../../state/current-user-context';
import { AllTicketsScreen } from './all-tickets-screen';

const createdAt = '2026-01-01T00:00:00.000Z';

function status(
  id: number,
  projectId: number,
  key: string,
  label: string,
  kind: Status['kind'],
  position: number,
): Status {
  return { id, projectId, key, label, kind, config: {}, position, archivedAt: null, createdAt };
}

function field(
  id: number,
  projectId: number,
  key: string,
  label: string,
  type: Field['type'],
  options: Field['options'] = [],
): Field {
  return {
    id,
    projectId,
    key,
    label,
    type,
    system: false,
    config: {},
    archivedAt: null,
    createdAt,
    options,
  };
}

function taskType(id: number, projectId: number): TicketType {
  return {
    id,
    projectId,
    key: 'task',
    label: 'Task',
    config: {},
    position: 1,
    archivedAt: null,
    createdAt,
  };
}

const severityOptions = (base: number): Field['options'] => [
  {
    id: base,
    value: 'sev1',
    label: 'Sev 1',
    config: { color: '#a03028' },
    position: 1,
    archivedAt: null,
  },
  {
    id: base + 1,
    value: 'sev2',
    label: 'Sev 2',
    config: { color: '#a44e14' },
    position: 2,
    archivedAt: null,
  },
];

// Two projects with different prefixes; 'severity' (select) is shared —
// same key + type in both — while 'flavor' exists only in Items Core.
function makeCoreBoard(): Board {
  return {
    project: { id: 1, key: 'core', name: 'Items Core', ticketPrefix: 'CORE', createdAt },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null, createdAt }],
    types: [taskType(1, 1)],
    typeFields: [
      { ticketTypeId: 1, fieldId: 11, position: 1, required: true },
      { ticketTypeId: 1, fieldId: 10, position: 2, required: true },
      { ticketTypeId: 1, fieldId: 12, position: 3, required: false },
    ],
    statuses: [
      status(1, 1, 'backlog', 'Backlog', 'todo', 1),
      status(2, 1, 'doing', 'Doing', 'active', 2),
    ],
    transitions: [],
    fields: [
      field(10, 1, 'status', 'Status', 'status'),
      field(11, 1, 'title', 'Title', 'text'),
      field(12, 1, 'severity', 'Severity', 'select', severityOptions(1)),
      field(13, 1, 'flavor', 'Flavor', 'text'),
    ],
    linkTypes: [],
    views: [],
    tickets: [
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
    project: { id: 2, key: 'app', name: 'Items App', ticketPrefix: 'APP', createdAt },
    users: [{ id: 9, name: 'Jae R', email: null, kind: 'human', archivedAt: null, createdAt }],
    types: [taskType(5, 2)],
    typeFields: [
      { ticketTypeId: 5, fieldId: 21, position: 1, required: true },
      { ticketTypeId: 5, fieldId: 20, position: 2, required: true },
      { ticketTypeId: 5, fieldId: 22, position: 3, required: false },
    ],
    statuses: [status(21, 2, 'todo', 'To do', 'todo', 1)],
    transitions: [],
    fields: [
      field(20, 2, 'status', 'Status', 'status'),
      field(21, 2, 'title', 'Title', 'text'),
      field(22, 2, 'severity', 'Severity', 'select', severityOptions(5)),
    ],
    linkTypes: [],
    views: [],
    tickets: [
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
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
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
  const rootRoute = createRootRoute({ component: () => <AllTicketsScreen /> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <QueryClientProvider client={client}>
      <CurrentUserProvider>
        <RouterProvider router={router} />
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
  // header meta counts top-level tickets and loaded projects
  expect(screen.getByText('3 tickets · 2 projects')).toBeInTheDocument();
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

test('clicking a row opens the ticket drawer with that project’s board', async () => {
  await renderScreen();
  fireEvent.click(screen.getByText('Ship mobile nav'));
  const drawer = await screen.findByRole('complementary', { name: 'Ticket detail' });
  expect(within(drawer).getByText('APP-1')).toBeInTheDocument();
  expect(within(drawer).getByRole('button', { name: /ship mobile nav/i })).toBeInTheDocument();
});
