import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board } from '../api/types';
import { CurrentUserProvider } from '../state/current-user-context';
import { indexBoard } from '../utils/index-board';
import { KanbanView } from './kanban-view';

function makeBoard(): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', ticketPrefix: 'CORE', createdAt },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null, createdAt }],
    types: [
      {
        id: 1,
        projectId: 1,
        key: 'task',
        label: 'Task',
        config: {},
        position: 1,
        archivedAt: null,
        createdAt,
      },
    ],
    typeFields: [],
    statuses: [
      {
        id: 1,
        projectId: 1,
        key: 'backlog',
        label: 'Backlog',
        kind: 'todo',
        config: {},
        position: 1,
        archivedAt: null,
        createdAt,
      },
      {
        id: 2,
        projectId: 1,
        key: 'in-review',
        label: 'In review',
        kind: 'active',
        config: {},
        position: 2,
        archivedAt: null,
        createdAt,
      },
      {
        id: 3,
        projectId: 1,
        key: 'shipped',
        label: 'Shipped',
        kind: 'done',
        config: {},
        position: 3,
        archivedAt: null,
        createdAt,
      },
    ],
    // only backlog → in-review is a legal move
    transitions: [{ id: 1, fromStatusId: 1, toStatusId: 2, ticketTypeId: null, config: {} }],
    fields: [
      {
        id: 10,
        projectId: 1,
        key: 'status',
        label: 'Status',
        type: 'status',
        system: true,
        config: {},
        archivedAt: null,
        createdAt,
        options: [],
      },
      {
        id: 11,
        projectId: 1,
        key: 'title',
        label: 'Title',
        type: 'text',
        system: true,
        config: {},
        archivedAt: null,
        createdAt,
        options: [],
      },
      {
        id: 12,
        projectId: 1,
        key: 'priority',
        label: 'Priority',
        type: 'select',
        system: false,
        config: {},
        archivedAt: null,
        createdAt,
        options: [
          {
            id: 1,
            value: 'p2',
            label: 'P2',
            config: { color: '#fab219' },
            position: 1,
            archivedAt: null,
          },
        ],
      },
    ],
    linkTypes: [],
    views: [],
    tickets: [
      {
        id: 100,
        number: 121,
        typeId: 1,
        parentId: null,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { status: 'backlog', title: 'Keyboard nav for board mode', priority: 'p2' },
        comments: [],
        links: [],
      },
      {
        id: 101,
        number: 122,
        typeId: 1,
        parentId: null,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { status: 'in-review', title: 'Ship the drop slots' },
        comments: [],
        links: [],
      },
    ],
  };
}

function renderKanban() {
  const board = makeBoard();
  const onOpenTicket = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CurrentUserProvider>
        <KanbanView
          board={board}
          indexes={indexBoard(board)}
          rows={board.tickets}
          projectKey="CORE"
          onOpenTicket={onOpenTicket}
        />
      </CurrentUserProvider>
    </QueryClientProvider>,
  );
  return { onOpenTicket };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('renders one column per status and groups tickets into their column', () => {
  renderKanban();
  const backlog = screen.getByRole('region', { name: 'Backlog' });
  const review = screen.getByRole('region', { name: 'In review' });
  const shipped = screen.getByRole('region', { name: 'Shipped' });
  expect(within(backlog).getByText('CORE-121')).toBeInTheDocument();
  expect(within(backlog).queryByText('CORE-122')).not.toBeInTheDocument();
  expect(within(review).getByText('CORE-122')).toBeInTheDocument();
  expect(within(shipped).queryByText(/CORE-/)).not.toBeInTheDocument();
  // column counts
  expect(within(backlog).getByText('1')).toBeInTheDocument();
  expect(within(shipped).getByText('0')).toBeInTheDocument();
});

test('clicking a card opens the ticket', async () => {
  const { onOpenTicket } = renderKanban();
  await userEvent.click(screen.getByRole('button', { name: /keyboard nav for board mode/i }));
  expect(onOpenTicket).toHaveBeenCalledWith(121);
});

test('dragging highlights legal targets, dims illegal ones, ghosts the origin', () => {
  localStorage.setItem('tickets-user-id', '7');
  renderKanban();
  fireEvent.dragStart(screen.getByRole('button', { name: /keyboard nav for board mode/i }));
  expect(screen.getByText('Drop — Backlog → In review')).toBeInTheDocument();
  expect(screen.getByText(/no transition Backlog → Shipped/)).toBeInTheDocument();
  expect(screen.getByText('CORE-121 — dragging…')).toBeInTheDocument();
});

test('dropping on a legal column PATCHes the status', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({ id: 100, updatedAt: 'later' })),
  });
  vi.stubGlobal('fetch', fetchMock);
  renderKanban();
  fireEvent.dragStart(screen.getByRole('button', { name: /keyboard nav for board mode/i }));
  fireEvent.drop(screen.getByRole('region', { name: 'In review' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/tickets/100');
  expect(init.method).toBe('PATCH');
  expect(JSON.parse(String(init.body))).toMatchObject({
    actorId: 7,
    expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    values: { status: 'in-review' },
  });
});
