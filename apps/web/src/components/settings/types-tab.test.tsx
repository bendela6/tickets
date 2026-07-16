import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Board } from '../../api/types';
import { CurrentUserProvider } from '../../state/current-user-context';
import { indexBoard } from '../../utils/index-board';
import { TypesTab } from './types-tab';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeBoard(overrides: Partial<Board> = {}): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 5, itemPrefix: 'CORE', createdAt },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types: [
      { id: 1, schemeId: 5, key: 'epic', label: 'Epic', position: 1, config: { color: '#4E46C6' }, archivedAt: null },
      { id: 2, schemeId: 5, key: 'task', label: 'Task', position: 2, config: {}, archivedAt: null },
      { id: 3, schemeId: 5, key: 'old', label: 'Old', position: 3, config: {}, archivedAt: '2026-01-02T00:00:00.000Z' },
    ],
    fields: [],
    placements: [],
    options: [],
    transitions: [],
    linkTypes: [],
    targetTypes: [],
    views: [],
    childTypes: [],
    items: [],
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

function mockFetch() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderTab(board: Board) {
  renderWithProviders(<TypesTab board={board} indexes={indexBoard(board)} projectKey="CORE" />);
}

beforeEach(() => {
  localStorage.setItem('tickets-user-id', '7');
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('lists types with colour dot, label, key, and marks the archived one', () => {
  renderTab(makeBoard());

  // "Epic" and "Task" each also appear as a child-type chip on the *other*
  // type's card, so assert presence rather than uniqueness for those two.
  expect(screen.getAllByText('Epic').length).toBeGreaterThan(0);
  expect(screen.getByText('epic')).toBeInTheDocument();
  expect(screen.getAllByText('Task').length).toBeGreaterThan(0);
  expect(screen.getByText('Old')).toBeInTheDocument();
  expect(screen.getByText('ARCH')).toBeInTheDocument();
});

test('creating a type fires useCreateType — POSTs /api/types with the envelope + payload', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /new type/i }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Bug');
  await userEvent.click(screen.getByRole('button', { name: 'Create type' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types');
  expect(init.method).toBe('POST');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({
    actorId: 7,
    schemeId: 5,
    key: 'bug',
    label: 'Bug',
    config: { color: expect.any(String) },
  });
});

test('archiving a type fires useUpdateType — PATCHes /api/types/:id with archived: true', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /archive epic/i }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7, archived: true });
});

test('unarchiving a type fires useUpdateType with archived: false', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /unarchive old/i }));

  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/3');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(rest).toEqual({ actorId: 7, archived: false });
});

test('editing label/colour fires useUpdateType with the new label + config', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /edit epic/i }));
  const nameBox = screen.getByRole('textbox', { name: 'Name' });
  await userEvent.clear(nameBox);
  await userEvent.type(nameBox, 'Epic v2');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(rest).toEqual({ actorId: 7, label: 'Epic v2', config: { color: expect.any(String) } });
});

test('toggling a child-type chip fires useSetChildTypes — PUTs the updated childTypeIds', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  // Epic's child-type chip row offers Task (and not itself/archived Old).
  await userEvent.click(screen.getByRole('button', { name: 'Task', hidden: true }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1/child-types');
  expect(init.method).toBe('PUT');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7, childTypeIds: [2] });

  // toggling it again removes it — a second PUT with an empty array.
  await userEvent.click(screen.getByRole('button', { name: 'Task', hidden: true }));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [, init2] = fetchMock.mock.calls[1] as [string, RequestInit];
  const { childTypeIds } = JSON.parse(String(init2.body)) as Record<string, unknown>;
  expect(childTypeIds).toEqual([]);
});

test('seeds the chip editor from board.childTypes and does not wipe existing nesting rules on toggle', async () => {
  const fetchMock = mockFetch();
  const board: Board = {
    ...makeBoard(),
    types: [
      { id: 1, schemeId: 5, key: 'epic', label: 'Epic', position: 1, config: { color: '#4E46C6' }, archivedAt: null },
      { id: 2, schemeId: 5, key: 'task', label: 'Task', position: 2, config: {}, archivedAt: null },
      { id: 4, schemeId: 5, key: 'bug', label: 'Bug', position: 3, config: {}, archivedAt: null },
      { id: 5, schemeId: 5, key: 'spike', label: 'Spike', position: 4, config: {}, archivedAt: null },
      { id: 3, schemeId: 5, key: 'old', label: 'Old', position: 5, config: {}, archivedAt: '2026-01-02T00:00:00.000Z' },
    ],
    // epic already allows task + bug; the editor must render both as selected.
    childTypes: [
      { parentTypeId: 1, childTypeId: 2 },
      { parentTypeId: 1, childTypeId: 4 },
    ],
  };
  renderTab(board);

  // Scope to Epic's own card — "Spike"/"Task"/"Bug" chips also appear on
  // each other type's card as candidates, so an unscoped query is ambiguous.
  const epicCard = screen.getByText('epic').closest('section')!;
  const taskChip = within(epicCard).getByRole('button', { name: 'Task', hidden: true, pressed: true });
  const bugChip = within(epicCard).getByRole('button', { name: 'Bug', hidden: true, pressed: true });
  expect(taskChip).toBeInTheDocument();
  expect(bugChip).toBeInTheDocument();

  // Toggling a THIRD type on must PUT the full intended set — the existing
  // task + bug rows plus spike — not just the single clicked chip.
  await userEvent.click(within(epicCard).getByRole('button', { name: 'Spike', hidden: true }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1/child-types');
  expect(init.method).toBe('PUT');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({
    actorId: 7,
    childTypeIds: expect.arrayContaining([2, 4, 5]),
  });
  expect((rest.childTypeIds as number[]).length).toBe(3);
});

test('disables create/edit/archive actions when there is no current user', () => {
  localStorage.clear();
  mockFetch();
  renderTab(makeBoard());

  expect(screen.getByRole('button', { name: /new type/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /archive epic/i })).toBeDisabled();
});
