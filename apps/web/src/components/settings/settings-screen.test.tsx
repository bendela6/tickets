import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Board } from '../../api/types';
import { CurrentUserProvider } from '../../state/current-user-context';
import { SettingsScreen } from './settings-screen';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeBoard(overrides: Partial<Board> = {}): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 5, itemPrefix: 'CORE', createdAt },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types: [
      { id: 1, schemeId: 5, key: 'task', label: 'Task', position: 1, config: {}, archivedAt: null },
    ],
    fields: [
      {
        id: 10,
        schemeId: 5,
        key: 'status',
        label: 'Status',
        type: 'option',
        config: { workflow: true },
        optionSetId: 100,
        archivedAt: null,
      },
    ],
    placements: [{ itemTypeId: 1, fieldId: 10, position: 1, required: false, configOverride: null }],
    options: [
      { id: 1000, optionSetId: 100, value: 'backlog', label: 'Backlog', position: 1, kind: 'todo', config: {}, archivedAt: null },
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

function mockBoardFetch(board: Board) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(board)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// Routes each request by URL: board reads always return `board`; the fork
// and repoint mutations return their own canned responses so the fork flow
// (POST fork -> PATCH project -> board refetch) can be driven end to end.
function mockRoutedFetch(board: Board, forkedSchemeId: number) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (url.endsWith('/board')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(board)) });
    }
    if (url.endsWith('/fork')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ schemeId: forkedSchemeId })) });
    }
    if (url.startsWith('/api/projects/')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ id: board.project.id })) });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('renders the four tabs and the scheme banner once the board loads', async () => {
  mockBoardFetch(makeBoard());
  renderWithProviders(<SettingsScreen projectKey="CORE" />);

  expect(await screen.findByRole('tab', { name: /Types/ })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Fields/ })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Workflow/ })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Links/ })).toBeInTheDocument();

  expect(screen.getByText(/Editing the shared scheme/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Fork for this project/i })).toBeDisabled();

  // Types tab is the default panel.
  expect(screen.getByRole('heading', { name: 'Types' })).toBeInTheDocument();
});

test('switching tabs renders the corresponding placeholder panel', async () => {
  mockBoardFetch(makeBoard());
  renderWithProviders(<SettingsScreen projectKey="CORE" />);

  await screen.findByRole('tab', { name: /Types/ });

  await userEvent.click(screen.getByRole('tab', { name: /Fields/ }));
  expect(screen.getByRole('heading', { name: 'Fields' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('tab', { name: /Workflow/ }));
  expect(screen.getByRole('heading', { name: 'Workflow' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('tab', { name: /Links/ }));
  expect(screen.getByRole('heading', { name: 'Links' })).toBeInTheDocument();
});

test('clicking Fork forks the scheme then repoints the project to the forked scheme', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const board = makeBoard();
  const fetchMock = mockRoutedFetch(board, 42);
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

  renderWithProviders(<SettingsScreen projectKey="CORE" />);
  await screen.findByRole('tab', { name: /Types/ });

  const forkButton = screen.getByRole('button', { name: /Fork for this project/i });
  expect(forkButton).not.toBeDisabled();
  await userEvent.click(forkButton);

  expect(confirm).toHaveBeenCalledTimes(1);

  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/schemes/5/fork')).toBe(true);
  });
  const forkCall = fetchMock.mock.calls.find(([url]) => url === '/api/schemes/5/fork')!;
  const [, forkInit] = forkCall as [string, RequestInit];
  expect(forkInit.method).toBe('POST');
  const { commandId: forkCommandId, ...forkRest } = JSON.parse(String(forkInit.body)) as Record<string, unknown>;
  expect(forkCommandId).toMatch(UUID_RE);
  expect(forkRest).toEqual({ actorId: 7, key: expect.any(String), name: expect.any(String) });

  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/projects/1')).toBe(true);
  });
  const patchCall = fetchMock.mock.calls.find(([url]) => url === '/api/projects/1')!;
  const [, patchInit] = patchCall as [string, RequestInit];
  expect(patchInit.method).toBe('PATCH');
  const { commandId: patchCommandId, ...patchRest } = JSON.parse(String(patchInit.body)) as Record<string, unknown>;
  expect(patchCommandId).toMatch(UUID_RE);
  expect(patchRest).toEqual({ actorId: 7, schemeId: 42 });
});

test('declining the confirm dialog does not call the fork endpoint', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const board = makeBoard();
  const fetchMock = mockRoutedFetch(board, 42);
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

  renderWithProviders(<SettingsScreen projectKey="CORE" />);
  await screen.findByRole('tab', { name: /Types/ });

  await userEvent.click(screen.getByRole('button', { name: /Fork for this project/i }));

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/schemes/5/fork')).toBe(false);
});
