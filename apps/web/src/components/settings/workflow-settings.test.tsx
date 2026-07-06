import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board } from '../../api/types';
import { indexBoard } from '../../utils/index-board';
import { WorkflowSettings } from './workflow-settings';

function makeBoard(overrides: Partial<Board> = {}): Board {
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
      {
        id: 2,
        projectId: 1,
        key: 'bug',
        label: 'Bug',
        config: {},
        position: 2,
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
        config: { initial: true },
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
    transitions: [
      { id: 1, fromStatusId: 1, toStatusId: 2, ticketTypeId: null, config: {} },
      { id: 2, fromStatusId: 2, toStatusId: 3, ticketTypeId: 1, config: {} },
    ],
    fields: [],
    linkTypes: [],
    views: [],
    tickets: [],
    ...overrides,
  };
}

function renderWorkflow(overrides: Partial<Board> = {}) {
  const board = makeBoard(overrides);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <WorkflowSettings board={board} indexes={indexBoard(board)} projectKey="core" />
    </QueryClientProvider>,
  );
  return board;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('renders statuses with kind, key, entry marker and transitions with scope', () => {
  renderWorkflow();
  // status rows: label + mono key + kind chip
  expect(screen.getAllByText('Backlog').length).toBeGreaterThan(0);
  expect(screen.getByText('backlog')).toBeInTheDocument();
  expect(screen.getByText('in-review')).toBeInTheDocument();
  expect(screen.getByText('todo')).toBeInTheDocument();
  expect(screen.getByText('done')).toBeInTheDocument();
  // only Backlog is config.initial → exactly one entry pill in the status list
  expect(screen.getAllByText('entry')).toHaveLength(1);
  // header meta counts the transitions
  expect(screen.getByText(/2 transitions/)).toBeInTheDocument();
  // transition rows resolve status names and type scope via the board
  const unscoped = screen.getByRole('button', {
    name: 'Remove transition Backlog → In review',
  });
  expect(unscoped).toBeInTheDocument();
  expect(screen.getByText('all types')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Remove transition In review → Shipped' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Task')).toBeInTheDocument();
});

test('with no transitions, shows the anything-goes empty state', () => {
  renderWorkflow({ transitions: [] });
  expect(screen.getByText('No transitions defined — everything is allowed')).toBeInTheDocument();
  expect(screen.getByText('any status ⇄ any status')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '＋ First transition' })).toBeInTheDocument();
});

test('add transition POSTs from/to keys and omits an unset type scope', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () =>
      Promise.resolve(
        JSON.stringify({ id: 9, fromStatusId: 1, toStatusId: 3, ticketTypeId: null, config: {} }),
      ),
  });
  vi.stubGlobal('fetch', fetchMock);
  renderWorkflow();

  await userEvent.click(screen.getByRole('button', { name: 'From status' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Backlog' }));
  await userEvent.click(screen.getByRole('button', { name: 'To status' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Shipped' }));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/projects/core/status-transitions');
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({
    fromStatusKey: 'backlog',
    toStatusKey: 'shipped',
  });
});

test('add transition sends ticketTypeKey when a type scope is picked', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () =>
      Promise.resolve(
        JSON.stringify({ id: 9, fromStatusId: 1, toStatusId: 3, ticketTypeId: 2, config: {} }),
      ),
  });
  vi.stubGlobal('fetch', fetchMock);
  renderWorkflow();

  await userEvent.click(screen.getByRole('button', { name: 'From status' }));
  // entry edge: null fromStatusKey marks a valid starting status
  await userEvent.click(await screen.findByRole('option', { name: 'entry — new ticket' }));
  await userEvent.click(screen.getByRole('button', { name: 'To status' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Backlog' }));
  await userEvent.click(screen.getByRole('button', { name: 'All types' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Bug' }));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(JSON.parse(String(init.body))).toEqual({
    fromStatusKey: null,
    toStatusKey: 'backlog',
    ticketTypeKey: 'bug',
  });
});

test('deleting a transition confirms, then DELETEs the edge', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({ deleted: true })),
  });
  vi.stubGlobal('fetch', fetchMock);
  renderWorkflow();

  await userEvent.click(
    screen.getByRole('button', { name: 'Remove transition Backlog → In review' }),
  );
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Remove transition?')).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/status-transitions/1');
  expect(init.method).toBe('DELETE');
});
