import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Board } from '../../api/types';
import { CurrentUserProvider } from '../../state/current-user-context';
import { indexBoard } from '../../utils/index-board';
import { LinksTab } from './links-tab';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeBoard(overrides: Partial<Board> = {}): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 5, itemPrefix: 'CORE', createdAt },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types: [
      { id: 1, schemeId: 5, key: 'task', label: 'Task', position: 1, config: {}, archivedAt: null },
      { id: 2, schemeId: 5, key: 'bug', label: 'Bug', position: 2, config: {}, archivedAt: null },
      { id: 3, schemeId: 5, key: 'spike', label: 'Spike', position: 3, config: {}, archivedAt: null },
      { id: 4, schemeId: 5, key: 'old', label: 'Old', position: 4, config: {}, archivedAt: '2026-01-02T00:00:00.000Z' },
    ],
    fields: [],
    placements: [],
    options: [],
    transitions: [],
    linkTypes: [
      {
        id: 1,
        itemTypeId: 1,
        key: 'blocks-link',
        label: 'blocks',
        inverseLabel: 'is blocked by',
        directional: true,
        position: 1,
        archivedAt: null,
      },
      {
        id: 2,
        itemTypeId: 2,
        key: 'relates-to',
        label: 'relates to',
        inverseLabel: 'relates to',
        directional: false,
        position: 1,
        archivedAt: '2026-01-03T00:00:00.000Z',
      },
    ],
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
  renderWithProviders(<LinksTab board={board} indexes={indexBoard(board)} projectKey="CORE" />);
}

beforeEach(() => {
  localStorage.setItem('tickets-user-id', '7');
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('lists link types with label, inverse label, direction, owning type, and marks the archived one', () => {
  renderTab(makeBoard());

  expect(screen.getAllByText('blocks').length).toBeGreaterThan(0);
  expect(screen.getByText('is blocked by')).toBeInTheDocument();
  expect(screen.getAllByText('relates to').length).toBeGreaterThan(0);
  expect(screen.getByText('ARCH')).toBeInTheDocument();
});

test('creating a link type fires useCreateLinkType — POSTs /api/types/:typeId/link-types with the envelope + payload', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /new link type/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Type' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Task' }));
  await userEvent.type(screen.getByRole('textbox', { name: /outward label/i }), 'blocks');
  await userEvent.type(screen.getByRole('textbox', { name: /inward label/i }), 'is blocked by');
  await userEvent.click(screen.getByRole('button', { name: 'Create link type' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1/link-types');
  expect(init.method).toBe('POST');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({
    actorId: 7,
    key: 'blocks',
    label: 'blocks',
    inverseLabel: 'is blocked by',
    directional: true,
  });
});

test('archiving a link type fires useUpdateLinkType — PATCHes /api/link-types/:id with archived: true', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /archive blocks/i }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/link-types/1');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({ actorId: 7, archived: true });
});

test('unarchiving a link type fires useUpdateLinkType with archived: false', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /unarchive relates to/i }));

  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/link-types/2');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(rest).toEqual({ actorId: 7, archived: false });
});

test('editing label/inverseLabel/directional fires useUpdateLinkType with the new values', async () => {
  const fetchMock = mockFetch();
  renderTab(makeBoard());

  await userEvent.click(screen.getByRole('button', { name: /edit blocks/i }));
  const outwardBox = screen.getByRole('textbox', { name: /outward label/i });
  await userEvent.clear(outwardBox);
  await userEvent.type(outwardBox, 'blocks hard');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/link-types/1');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(rest).toEqual({
    actorId: 7,
    label: 'blocks hard',
    inverseLabel: 'is blocked by',
    directional: true,
  });
});

test('seeds the target-type chip editor from board.targetTypes and does not wipe existing targets on toggle', async () => {
  const fetchMock = mockFetch();
  const board: Board = {
    ...makeBoard(),
    // "blocks" (link type 1, owned by Task) already targets Bug + Spike.
    targetTypes: [
      { linkTypeId: 1, targetTypeId: 2 },
      { linkTypeId: 1, targetTypeId: 3 },
    ],
  };
  renderTab(board);

  const blocksCard = screen.getByText('blocks').closest('section')!;
  const bugChip = within(blocksCard).getByRole('button', { name: 'Bug', hidden: true, pressed: true });
  const spikeChip = within(blocksCard).getByRole('button', { name: 'Spike', hidden: true, pressed: true });
  expect(bugChip).toBeInTheDocument();
  expect(spikeChip).toBeInTheDocument();

  // Toggling a THIRD target type must PUT the full intended set — bug + spike
  // (already there) plus task — not just the single clicked chip. Sending only
  // the clicked id would silently wipe the existing bug/spike targets since
  // setTargetTypes is a full delete+reinsert replace on the server.
  await userEvent.click(within(blocksCard).getByRole('button', { name: 'Task', hidden: true }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/link-types/1/target-types');
  expect(init.method).toBe('PUT');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({
    actorId: 7,
    targetTypeIds: expect.arrayContaining([1, 2, 3]),
  });
  expect((rest.targetTypeIds as number[]).length).toBe(3);
});

test('toggling an already-selected target chip off PUTs the set minus that id', async () => {
  const fetchMock = mockFetch();
  const board: Board = {
    ...makeBoard(),
    targetTypes: [
      { linkTypeId: 1, targetTypeId: 2 },
      { linkTypeId: 1, targetTypeId: 3 },
    ],
  };
  renderTab(board);

  const blocksCard = screen.getByText('blocks').closest('section')!;
  await userEvent.click(within(blocksCard).getByRole('button', { name: 'Bug', hidden: true, pressed: true }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/link-types/1/target-types');
  expect(init.method).toBe('PUT');
  const { targetTypeIds } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(targetTypeIds).toEqual([3]);
});

test('disables create/edit/archive actions when there is no current user', () => {
  localStorage.clear();
  mockFetch();
  renderTab(makeBoard());

  expect(screen.getByRole('button', { name: /new link type/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /archive blocks/i })).toBeDisabled();
});
