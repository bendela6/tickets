import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Board } from '../../api/types';
import { CurrentUserProvider } from '../../state/current-user-context';
import { indexBoard } from '../../utils/index-board';
import { FieldsTab } from './fields-tab';

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
        id: 10,
        schemeId: 5,
        key: 'severity',
        label: 'Severity',
        type: 'option',
        config: {},
        optionSetId: 100,
        archivedAt: null,
      },
      {
        id: 11,
        schemeId: 5,
        key: 'story_points',
        label: 'Story points',
        type: 'number',
        config: {},
        optionSetId: null,
        archivedAt: null,
      },
      {
        id: 12,
        schemeId: 5,
        key: 'legacy_note',
        label: 'Legacy note',
        type: 'string',
        config: {},
        optionSetId: null,
        archivedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 13,
        schemeId: 5,
        key: 'component',
        label: 'Component',
        type: 'option',
        config: {},
        optionSetId: 101,
        archivedAt: null,
      },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 10, position: 1, required: false, configOverride: null },
      { itemTypeId: 1, fieldId: 11, position: 2, required: true, configOverride: null },
    ],
    options: [
      { id: 200, optionSetId: 100, value: 'low', label: 'Low', position: 1, kind: null, config: {}, archivedAt: null },
      { id: 201, optionSetId: 100, value: 'high', label: 'High', position: 2, kind: null, config: {}, archivedAt: null },
      { id: 210, optionSetId: 101, value: 'ui', label: 'UI', position: 1, kind: null, config: {}, archivedAt: null },
      { id: 211, optionSetId: 101, value: 'api', label: 'API', position: 2, kind: null, config: {}, archivedAt: null },
    ],
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
  renderWithProviders(<FieldsTab board={board} indexes={indexBoard(board)} projectKey="CORE" />);
}

beforeEach(() => {
  localStorage.setItem('tickets-user-id', '7');
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('lists the placements for the default (first) type, excluding unplaced/archived fields', () => {
  renderTab(makeBoard());

  const placements = screen.getByRole('region', { name: 'Placements' });
  expect(within(placements).getByText('Severity')).toBeInTheDocument();
  expect(within(placements).getByText('Story points')).toBeInTheDocument();
  // Component isn't placed on Bug; Legacy note is archived — neither shows as a placement row
  // (both still surface in the scheme-wide Field library section below).
  expect(within(placements).queryByText('Component')).not.toBeInTheDocument();
  expect(within(placements).queryByText('Legacy note')).not.toBeInTheDocument();
});

test('placing an existing library field fires usePlaceField — POST .../placement with the envelope', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /choose a field to place/i }));
  await userEvent.click(await screen.findByRole('option', { name: /component/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Place field' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1/fields/13/placement');
  expect(init.method).toBe('POST');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7 });
});

test('the place-field picker excludes an already-archived field', async () => {
  mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /choose a field to place/i }));
  expect(screen.queryByRole('option', { name: /legacy note/i })).not.toBeInTheDocument();
});

test('toggling a placement required fires useUpdatePlacement — PATCHes .../placement with required', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  const placements = screen.getByRole('region', { name: 'Placements' });
  const row = within(placements).getByText('Story points').closest('div')!;
  await userEvent.click(within(row).getByRole('switch', { name: 'Required' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1/fields/11/placement');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7, required: false });
});

test('setting an option allowlist fires useUpdatePlacement — PATCHes .../placement with allowedOptionIds', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  // Severity's placement has no configOverride yet, so both options (Low, High)
  // start selected; removing High's chip narrows the allowlist to [Low].
  await userEvent.click(screen.getByRole('button', { name: /remove high/i }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1/fields/10/placement');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7, allowedOptionIds: [200] });
});

test('unplacing a field fires useUnplaceField — DELETEs .../placement', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /unplace story points/i }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1/fields/11/placement');
  expect(init.method).toBe('DELETE');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7 });
});

test('creating a new field fires useCreateField — POSTs /api/types/:typeId/fields', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: '+ New field' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Label' }), 'Points cap');
  await userEvent.click(screen.getByRole('button', { name: 'Create field' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1/fields');
  expect(init.method).toBe('POST');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7, key: 'points_cap', label: 'Points cap', type: 'string' });
});

test('archiving a library field fires useUpdateField — PATCHes /api/fields/:id with archived: true (no optionSetId)', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /archive component/i }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/fields/13');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7, archived: true });
});

test('disables placement/library actions when there is no current user', () => {
  localStorage.clear();
  mockFetch();
  renderTab(makeBoard());

  expect(screen.getByRole('button', { name: '+ New field' })).toBeDisabled();
  expect(screen.getAllByRole('switch', { name: 'Required' })[0]).toBeDisabled();
  expect(screen.getByRole('button', { name: /archive component/i })).toBeDisabled();
});
