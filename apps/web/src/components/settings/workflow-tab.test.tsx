import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Board } from '../../api/types';
import { CurrentUserProvider } from '../../state/current-user-context';
import { indexBoard } from '../../utils/index-board';
import { WorkflowTab } from './workflow-tab';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeBoard(overrides: Partial<Board> = {}): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 5, itemPrefix: 'CORE', createdAt },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types: [
      { id: 1, schemeId: 5, key: 'bug', label: 'Bug', position: 1, config: {}, archivedAt: null },
      { id: 2, schemeId: 5, key: 'task', label: 'Task', position: 2, config: {}, archivedAt: null },
    ],
    fields: [
      {
        id: 20,
        schemeId: 5,
        key: 'status',
        label: 'Status',
        type: 'option',
        config: { workflow: true },
        optionSetId: 300,
        archivedAt: null,
      },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 20, position: 1, required: true, configOverride: null },
      { itemTypeId: 2, fieldId: 20, position: 1, required: true, configOverride: null },
    ],
    options: [
      { id: 400, optionSetId: 300, value: 'todo', label: 'To do', position: 1, kind: 'todo', config: { color: '#79756A' }, archivedAt: null },
      {
        id: 401,
        optionSetId: 300,
        value: 'active',
        label: 'In progress',
        position: 2,
        kind: 'active',
        config: { color: '#2E6FCC', icon: 'bolt' },
        archivedAt: null,
      },
      {
        id: 402,
        optionSetId: 300,
        value: 'old',
        label: 'Old status',
        position: 3,
        kind: 'dropped',
        config: {},
        archivedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
    // Bug has two edges (an entry edge + todo->active); Task has none, so it
    // exercises the "any move is allowed" empty-set hint.
    transitions: [
      { id: 500, fieldId: 20, itemTypeId: 1, fromOptionId: null, toOptionId: 400, config: null },
      { id: 501, fieldId: 20, itemTypeId: 1, fromOptionId: 400, toOptionId: 401, config: null },
    ],
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
  renderWithProviders(<WorkflowTab board={board} indexes={indexBoard(board)} projectKey="CORE" />);
}

beforeEach(() => {
  localStorage.setItem('tickets-user-id', '7');
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test("lists the workflow field's options for the default (first) type, including the archived one", () => {
  renderTab(makeBoard());

  const optionsRegion = screen.getByRole('region', { name: 'Options' });
  expect(within(optionsRegion).getByText('To do')).toBeInTheDocument();
  expect(within(optionsRegion).getByText('In progress')).toBeInTheDocument();
  expect(within(optionsRegion).getByText('Old status')).toBeInTheDocument();
  expect(within(optionsRegion).getByText('ARCH')).toBeInTheDocument();
});

test('lists the transition edges for the default type, rendering option labels not ids', () => {
  renderTab(makeBoard());

  const transitionsRegion = screen.getByRole('region', { name: 'Transitions' });
  expect(within(transitionsRegion).getByText('entry')).toBeInTheDocument();
  expect(within(transitionsRegion).getAllByText('To do').length).toBeGreaterThan(0);
  expect(within(transitionsRegion).getByText('In progress')).toBeInTheDocument();
});

test('shows the "any move allowed" hint when the selected type has no transition edges', async () => {
  renderTab(makeBoard());

  // The type selector is a Pill toggle (button + aria-pressed), not an ARIA
  // tab, since it moved off the retired custom tablist markup onto the
  // shared Pill primitive.
  await userEvent.click(screen.getByRole('button', { name: 'Task' }));

  const transitionsRegion = screen.getByRole('region', { name: 'Transitions' });
  expect(within(transitionsRegion).getByText(/any move is allowed/i)).toBeInTheDocument();
});

test('adding an option fires useCreateOption — POST /api/fields/:id/options with value/label/kind', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: '+ Add option' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Label' }), 'In review');
  await userEvent.click(screen.getByRole('button', { name: 'Create option' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/fields/20/options');
  expect(init.method).toBe('POST');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({
    actorId: 7,
    value: 'in-review',
    label: 'In review',
    kind: 'todo',
    config: { color: expect.any(String) },
  });
});

test('adding an edge fires useCreateTransition — POST /api/fields/:id/transitions with fromOptionId/toOptionId/itemTypeId', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  const transitionsRegion = screen.getByRole('region', { name: 'Transitions' });
  await userEvent.click(within(transitionsRegion).getByRole('button', { name: 'From option' }));
  await userEvent.click(await screen.findByRole('option', { name: 'To do' }));
  await userEvent.click(within(transitionsRegion).getByRole('button', { name: 'To option' }));
  await userEvent.click(await screen.findByRole('option', { name: 'In progress' }));
  await userEvent.click(within(transitionsRegion).getByRole('button', { name: 'Add edge' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/fields/20/transitions');
  expect(init.method).toBe('POST');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7, fromOptionId: 400, toOptionId: 401, itemTypeId: 1 });
});

test('adding an edge with "requires a comment" checked sends config: { guard: { requiresComment: true } }', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  const transitionsRegion = screen.getByRole('region', { name: 'Transitions' });
  await userEvent.click(within(transitionsRegion).getByRole('button', { name: 'From option' }));
  await userEvent.click(await screen.findByRole('option', { name: 'To do' }));
  await userEvent.click(within(transitionsRegion).getByRole('button', { name: 'To option' }));
  await userEvent.click(await screen.findByRole('option', { name: 'In progress' }));
  await userEvent.click(within(transitionsRegion).getByRole('checkbox', { name: 'Requires a comment' }));
  await userEvent.click(within(transitionsRegion).getByRole('button', { name: 'Add edge' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/fields/20/transitions');
  expect(init.method).toBe('POST');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({
    actorId: 7,
    fromOptionId: 400,
    toOptionId: 401,
    itemTypeId: 1,
    config: { guard: { requiresComment: true } },
  });
});

test('adding an edge with no guard inputs set sends a body with no `config` key', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  const transitionsRegion = screen.getByRole('region', { name: 'Transitions' });
  await userEvent.click(within(transitionsRegion).getByRole('button', { name: 'From option' }));
  await userEvent.click(await screen.findByRole('option', { name: 'To do' }));
  await userEvent.click(within(transitionsRegion).getByRole('button', { name: 'To option' }));
  await userEvent.click(await screen.findByRole('option', { name: 'In progress' }));
  await userEvent.click(within(transitionsRegion).getByRole('button', { name: 'Add edge' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect('config' in body).toBe(false);
});

test('deleting an edge fires useDeleteTransition — DELETE /api/transitions/:id', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  const transitionsRegion = screen.getByRole('region', { name: 'Transitions' });
  await userEvent.click(
    within(transitionsRegion).getByRole('button', { name: 'Remove transition To do → In progress' }),
  );

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/transitions/501');
  expect(init.method).toBe('DELETE');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7 });
});

test('archiving an option fires useUpdateOption — PATCH /api/options/:id with archived: true', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  const optionsRegion = screen.getByRole('region', { name: 'Options' });
  await userEvent.click(within(optionsRegion).getByRole('button', { name: 'Archive To do' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/options/400');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7, archived: true });
});

test('restoring an archived option fires useUpdateOption with archived: false', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  const optionsRegion = screen.getByRole('region', { name: 'Options' });
  await userEvent.click(within(optionsRegion).getByRole('button', { name: 'Restore Old status' }));

  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/options/402');
  const { archived } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(archived).toBe(false);
});

test('editing an option label/kind fires useUpdateOption, preserving other config keys', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  const optionsRegion = screen.getByRole('region', { name: 'Options' });
  await userEvent.click(within(optionsRegion).getByRole('button', { name: 'Edit In progress' }));
  const labelBox = screen.getByRole('textbox', { name: 'Label' });
  await userEvent.clear(labelBox);
  await userEvent.type(labelBox, 'Doing');
  await userEvent.click(screen.getByRole('button', { name: 'blocked' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/options/401');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  // config keeps the pre-existing `icon` even though only label/kind changed —
  // option.update REPLACES config wholesale, so the editor must seed from it.
  expect(rest).toEqual({
    actorId: 7,
    label: 'Doing',
    kind: 'blocked',
    config: { color: '#2E6FCC', icon: 'bolt' },
  });
});

test('disables option/edge actions when there is no current user', () => {
  localStorage.clear();
  mockFetch();
  renderTab(makeBoard());

  expect(screen.getByRole('button', { name: '+ Add option' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Archive To do' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Remove transition To do → In progress' }),
  ).toBeDisabled();
});
