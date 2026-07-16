import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Board } from '../api/types';
import { CurrentUserProvider } from '../state/current-user-context';
import { indexBoard } from '../utils/index-board';
import { NewItemDialog, SubtaskQuickCreate } from './new-item-dialog';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigateMock }));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeBoard(overrides: Partial<Board> = {}): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 1, itemPrefix: 'CORE', createdAt },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types: [
      { id: 1, schemeId: 1, key: 'task', label: 'Task', config: {}, archivedAt: null },
      { id: 2, schemeId: 1, key: 'bug', label: 'Bug', config: { color: '#a03028' }, archivedAt: null },
      { id: 3, schemeId: 1, key: 'subtask', label: 'Subtask', config: {}, archivedAt: null },
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
      {
        id: 12,
        schemeId: 1,
        key: 'severity',
        label: 'Severity',
        type: 'option',
        config: {},
        optionSetId: 200,
        archivedAt: null,
      },
      {
        id: 13,
        schemeId: 1,
        key: 'description',
        label: 'Description',
        type: 'string',
        config: { format: 'markdown' },
        optionSetId: null,
        archivedAt: null,
      },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 11, position: 1, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 10, position: 2, required: false, configOverride: null },
      { itemTypeId: 2, fieldId: 11, position: 1, required: true, configOverride: null },
      { itemTypeId: 2, fieldId: 12, position: 2, required: true, configOverride: null },
      { itemTypeId: 2, fieldId: 13, position: 3, required: false, configOverride: null },
      { itemTypeId: 2, fieldId: 10, position: 4, required: false, configOverride: null },
      { itemTypeId: 3, fieldId: 11, position: 1, required: true, configOverride: null },
    ],
    options: [
      { id: 1000, optionSetId: 100, value: 'backlog', label: 'Backlog', position: 1, kind: 'todo', config: {}, archivedAt: null },
      { id: 1001, optionSetId: 100, value: 'in-review', label: 'In review', position: 2, kind: 'active', config: {}, archivedAt: null },
      { id: 2000, optionSetId: 200, value: 'low', label: 'Low', position: 1, kind: null, config: {}, archivedAt: null },
      { id: 2001, optionSetId: 200, value: 'high', label: 'High', position: 2, kind: null, config: {}, archivedAt: null },
    ],
    transitions: [],
    linkTypes: [],
    views: [],
    items: [
      {
        id: 100,
        number: 128,
        typeId: 1,
        parentId: null,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { status: 'backlog', title: 'Parent item' },
        comments: [],
        links: [],
      },
    ],
    ...overrides,
  };
}

function renderWithProviders(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CurrentUserProvider>{node}</CurrentUserProvider>
    </QueryClientProvider>,
  );
}

function renderDialog(board: Board) {
  const onClose = vi.fn();
  renderWithProviders(
    <NewItemDialog
      projectKey="CORE"
      board={board}
      indexes={indexBoard(board)}
      open
      onClose={onClose}
    />,
  );
  return { onClose };
}

function mockCreateFetch(created: Record<string, unknown>) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(created)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.setItem('tickets-user-id', '7');
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  navigateMock.mockClear();
});

test('step 1 lists creatable types with field counts; subtask is not pickable', () => {
  renderDialog(makeBoard());
  expect(screen.getByText('New item')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /task/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /bug.*4 fields.*2 required/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /subtask/i })).not.toBeInTheDocument();
  expect(screen.getByText(/Created from a parent item’s Subtasks section/)).toBeInTheDocument();
});

test('pick type → fill title → required gate → submit POSTs body and opens the item', async () => {
  const fetchMock = mockCreateFetch({ id: 500, number: 136 });
  const { onClose } = renderDialog(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /bug/i }));
  expect(screen.getByText('New Bug')).toBeInTheDocument();

  await userEvent.type(
    screen.getByRole('textbox', { name: 'Title' }),
    'Select options lose order after archive',
  );

  // severity is required for bugs — the first submit is blocked inline
  await userEvent.click(screen.getByRole('button', { name: 'Create item' }));
  expect(await screen.findByText('Required for bugs')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: '—' }));
  await userEvent.click(await screen.findByRole('option', { name: 'High' }));

  await userEvent.click(screen.getByRole('button', { name: 'Create item' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/projects/CORE/items');
  expect(init.method).toBe('POST');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({
    actorId: 7,
    typeKey: 'bug',
    values: {
      title: 'Select options lose order after archive',
      severity: 'high',
      status: 'backlog',
    },
  });

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(navigateMock).toHaveBeenCalledTimes(1);
  const navArg = navigateMock.mock.calls[0]?.[0] as {
    to: string;
    search: (previous: Record<string, unknown>) => Record<string, unknown>;
  };
  expect(navArg.to).toBe('.');
  expect(navArg.search({})).toEqual({ t: 136 });
});

test('skips the picker when only one creatable type exists', () => {
  const board = makeBoard();
  renderDialog({ ...board, types: board.types.filter((type) => type.key !== 'bug') });
  expect(screen.getByText('New Task')).toBeInTheDocument();
  expect(screen.queryByText('‹ Type')).not.toBeInTheDocument();
});

test('SubtaskQuickCreate posts a subtask under the parent on Enter', async () => {
  const fetchMock = mockCreateFetch({ id: 501, number: 129 });
  const board = makeBoard();
  const onCreated = vi.fn();
  renderWithProviders(
    <SubtaskQuickCreate
      projectKey="CORE"
      board={board}
      indexes={indexBoard(board)}
      parent={board.items[0]!}
      onCreated={onCreated}
    />,
  );
  // compact type select defaults to the subtask type
  expect(screen.getByRole('button', { name: 'Subtask' })).toBeInTheDocument();

  const input = screen.getByRole('textbox', { name: 'Subtask title' });
  await userEvent.type(input, 'Audit column-width persistence{Enter}');

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/projects/CORE/items');
  expect(init.method).toBe('POST');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({
    actorId: 7,
    typeKey: 'subtask',
    parentId: 100,
    values: { title: 'Audit column-width persistence' },
  });
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 501, number: 129 }));
  expect(input).toHaveValue('');
});
