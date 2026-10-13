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
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 5, itemPrefix: 'CORE', createdAt, repositoryUrl: null, defaultBranch: null },
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

  await userEvent.click(screen.getByRole('tab', { name: 'Task' }));

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

// A shared status set two types take parts of, as the plan scheme does (TK-80.1):
// Feature takes Planning..Cancelled plus the archived Shelved, Ticket takes
// To do, Done and Cancelled — its allowlist written out of option order.
function makeSharedSetBoard(): Board {
  const option = (id: number, value: string, label: string, position: number, kind: Board['options'][number]['kind'], archivedAt: string | null = null) => ({
    id, optionSetId: 300, value, label, position, kind, config: {}, archivedAt,
  });
  return makeBoard({
    types: [
      { id: 1, schemeId: 5, key: 'feature', label: 'Feature', position: 1, config: {}, archivedAt: null },
      { id: 2, schemeId: 5, key: 'ticket', label: 'Ticket', position: 2, config: {}, archivedAt: null },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 20, position: 1, required: true, configOverride: { allowedOptionIds: [410, 412, 413, 414, 415] } },
      { itemTypeId: 2, fieldId: 20, position: 1, required: true, configOverride: { allowedOptionIds: [413, 411, 414] } },
    ],
    options: [
      option(410, 'planning', 'Planning', 1, 'todo'),
      option(411, 'todo', 'To do', 2, 'todo'),
      option(412, 'in-progress', 'In progress', 3, 'active'),
      option(413, 'done', 'Done', 4, 'done'),
      option(414, 'cancelled', 'Cancelled', 5, 'dropped'),
      option(415, 'shelved', 'Shelved', 6, 'dropped', '2026-01-02T00:00:00.000Z'),
    ],
    transitions: [],
  });
}

function listedStatuses(): string[] {
  const optionsRegion = screen.getByRole('region', { name: 'Options' });
  return within(optionsRegion)
    .getAllByRole('button', { name: /^Edit / })
    .map((button) => (button.getAttribute('aria-label') ?? '').replace(/^Edit /, ''));
}

test("shows only the statuses a type takes from a shared set, its archived one included", () => {
  renderTab(makeSharedSetBoard());

  expect(listedStatuses()).toEqual(['Planning', 'In progress', 'Done', 'Cancelled', 'Shelved']);
  const optionsRegion = screen.getByRole('region', { name: 'Options' });
  expect(within(optionsRegion).queryByText('To do')).not.toBeInTheDocument();
  expect(within(optionsRegion).getByRole('button', { name: 'Restore Shelved' })).toBeInTheDocument();
  expect(within(optionsRegion).getByText('5 options · 1 archived')).toBeInTheDocument();
});

test("shows another type's own statuses in option order when it is picked", async () => {
  renderTab(makeSharedSetBoard());

  await userEvent.click(screen.getByRole('tab', { name: 'Ticket' }));

  expect(listedStatuses()).toEqual(['To do', 'Done', 'Cancelled']);
  const optionsRegion = screen.getByRole('region', { name: 'Options' });
  expect(within(optionsRegion).queryByText('Planning')).not.toBeInTheDocument();
  expect(within(optionsRegion).queryByText('In progress')).not.toBeInTheDocument();
  expect(within(optionsRegion).queryByText('Shelved')).not.toBeInTheDocument();
  expect(within(optionsRegion).getByText('3 options')).toBeInTheDocument();
});

test("offers only the type's own statuses as the ends of a new edge", async () => {
  renderTab(makeSharedSetBoard());

  await userEvent.click(screen.getByRole('tab', { name: 'Ticket' }));
  const transitionsRegion = screen.getByRole('region', { name: 'Transitions' });
  await userEvent.click(within(transitionsRegion).getByRole('button', { name: 'To option' }));

  const offered = (await screen.findAllByRole('option')).map((option) => option.textContent);
  expect(offered).toEqual(['To do', 'Done', 'Cancelled']);
});

test("adding an option to a type that takes only some statuses adds it to that type's statuses too", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('{"id":420}') })
    .mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') });
  vi.stubGlobal('fetch', fetchMock);
  renderTab(makeSharedSetBoard());

  await userEvent.click(screen.getByRole('tab', { name: 'Ticket' }));
  await userEvent.click(screen.getByRole('button', { name: '+ Add option' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Label' }), 'Blocked');
  await userEvent.click(screen.getByRole('button', { name: 'Create option' }));

  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [createUrl, createInit] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(createUrl).toBe('/api/fields/20/options');
  expect(createInit.method).toBe('POST');
  const [placeUrl, placeInit] = fetchMock.mock.calls[1] as [string, RequestInit];
  expect(placeUrl).toBe('/api/types/2/fields/20/placement');
  expect(placeInit.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(placeInit.body)) as Record<string, unknown>;
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7, allowedOptionIds: [413, 411, 414, 420] });
});
