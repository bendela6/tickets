import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board } from '../../api/types';
import { rootRoute } from '../../routes/root-route';
import { settingsRouteTree } from '../../routes/settings-route';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeBoard(overrides: Partial<Board> = {}): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 5, itemPrefix: 'CORE', createdAt, repositoryUrl: null, defaultBranch: null },
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

/**
 * Mounts the REAL settings routes under the REAL root route, on a memory
 * history: which tab is on screen is the address's, so it is the route tree
 * that is under test, not SettingsScreen alone. The root route brings the
 * frame, whose sidebar lists the tabs under Settings; what the frame reads is
 * answered here (one project, CORE, and no users), and every other request
 * goes to the test's own `fetch` mock.
 */
function renderSettings({
  path = '/p/CORE/settings/types',
  client,
}: { path?: string; client?: QueryClient } = {}) {
  const inner = globalThis.fetch;
  const projects = { data: [{ ...makeBoard().project, key: 'CORE' }] };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/projects' || url.startsWith('/api/users')) {
        const body = url === '/api/projects' ? projects : { data: [] };
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(body)) });
      }
      return inner(url, init);
    }),
  );
  const qc =
    client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  const router = createRouter({
    routeTree: rootRoute.addChildren([settingsRouteTree]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client: qc, router };
}

/** A settings tab's link, under Settings in the sidebar. */
async function tabLink(label: string) {
  const nav = await screen.findByRole('complementary', { name: 'Navigation' });
  return within(nav).findByRole('link', { name: label });
}

const FORK_DIALOG_TITLE = 'Fork the shared scheme?';

/** The dialog Fork for this project asks in before it forks anything. */
function findForkDialog() {
  return screen.findByRole('dialog', { name: FORK_DIALOG_TITLE });
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('lists the five tabs under Settings and shows the scheme banner once the board loads', async () => {
  mockBoardFetch(makeBoard());
  renderSettings();

  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Types' })).toBeInTheDocument();
  expect(await tabLink('Types')).toHaveAttribute('href', '/p/CORE/settings/types');
  expect(await tabLink('Fields')).toHaveAttribute('href', '/p/CORE/settings/fields');
  expect(await tabLink('Workflow')).toHaveAttribute('href', '/p/CORE/settings/workflow');
  expect(await tabLink('Links')).toHaveAttribute('href', '/p/CORE/settings/links');
  expect(await tabLink('Repository')).toHaveAttribute('href', '/p/CORE/settings/repository');

  expect(screen.getByText(/Editing the shared scheme/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Fork for this project/i })).toBeDisabled();
});

test('the bare settings address opens the Types tab', async () => {
  mockBoardFetch(makeBoard());
  const { router } = renderSettings({ path: '/p/CORE/settings' });

  expect(await screen.findByRole('heading', { name: 'Types' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/p/CORE/settings/types');
});

test('each tab opens from its own address, its link lit in the sidebar', async () => {
  mockBoardFetch(makeBoard());
  renderSettings({ path: '/p/CORE/settings/workflow' });

  expect(await screen.findByRole('heading', { name: 'Workflow' })).toBeInTheDocument();
  expect(await tabLink('Workflow')).toHaveAttribute('aria-current', 'page');
  expect(await tabLink('Types')).not.toHaveAttribute('aria-current');
  expect(screen.queryByRole('heading', { name: 'Types' })).not.toBeInTheDocument();
});

test('following a tab in the sidebar goes to its address and renders its panel', async () => {
  mockBoardFetch(makeBoard());
  const { router } = renderSettings();

  await screen.findByRole('heading', { name: 'Types' });

  await userEvent.click(await tabLink('Fields'));
  expect(await screen.findByRole('heading', { name: 'Fields' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/p/CORE/settings/fields');

  await userEvent.click(await tabLink('Workflow'));
  expect(await screen.findByRole('heading', { name: 'Workflow' })).toBeInTheDocument();

  await userEvent.click(await tabLink('Links'));
  expect(await screen.findByRole('heading', { name: 'Links' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/p/CORE/settings/links');
});

// The repository is the project's own, so the banner about the shared scheme
// is left off its tab, and comes back on the scheme's.
test('the Repository tab shows the project\'s repository without the scheme banner', async () => {
  mockBoardFetch(makeBoard());
  renderSettings();
  await screen.findByRole('heading', { name: 'Types' });

  await userEvent.click(await tabLink('Repository'));
  expect(await screen.findByRole('heading', { name: 'Repository' })).toBeInTheDocument();
  expect(screen.getByLabelText('Git link')).toBeInTheDocument();
  expect(screen.queryByText(/Editing the shared scheme/)).not.toBeInTheDocument();

  await userEvent.click(await tabLink('Links'));
  expect(await screen.findByText(/Editing the shared scheme/)).toBeInTheDocument();
});
test('clicking Fork forks the scheme then repoints the project to the forked scheme', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const board = makeBoard();
  const fetchMock = mockRoutedFetch(board, 42);

  renderSettings();
  await screen.findByRole('heading', { name: 'Types' });

  const forkButton = screen.getByRole('button', { name: /Fork for this project/i });
  expect(forkButton).not.toBeDisabled();
  await userEvent.click(forkButton);

  // Nothing is forked until the confirm dialog is answered.
  const dialog = await findForkDialog();
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/schemes/5/fork')).toBe(false);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Fork' }));

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

  renderSettings();
  await screen.findByRole('heading', { name: 'Types' });

  await userEvent.click(screen.getByRole('button', { name: /Fork for this project/i }));

  const dialog = await findForkDialog();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: FORK_DIALOG_TITLE })).not.toBeInTheDocument();
  });
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/schemes/5/fork')).toBe(false);
});

// Regression test for the fork-wipes-copied-rules bug: `TypesTab` seeds a
// `childSelections` state map keyed by *type* id from `board.childTypes` on
// mount. `schemeFork` re-inserts every type under FRESH ids (see
// `apps/api/src/command/config/scheme.ts`), so after the board refetch that
// follows a fork+repoint, the panel must re-seed from the NEW board rather
// than keep stale selections keyed by the old (now-foreign) type ids —
// otherwise the chips render unselected even though the DB has the copied
// rows, and the next click PUTs a single-element set that wipes them via
// `type.setChildTypes`'s delete-all-then-insert replace. Without the
// `key={board.project.schemeId}` remount in settings-screen.tsx, this test
// fails: the panel keeps looking up `childSelections[1]` (the old parent id)
// instead of `childSelections[101]` and the chip never shows as selected.
test('re-seeds the child-type chip editor from a fresh board after the scheme changes, instead of keeping stale selections', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const boardA = makeBoard({
    types: [
      { id: 1, schemeId: 5, key: 'epic', label: 'Epic', position: 1, config: {}, archivedAt: null },
      { id: 2, schemeId: 5, key: 'task', label: 'Task', position: 2, config: {}, archivedAt: null },
    ],
    childTypes: [{ parentTypeId: 1, childTypeId: 2 }],
  });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(JSON.stringify(boardA)) });
  vi.stubGlobal('fetch', fetchMock);

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  renderSettings({ client });

  await screen.findByRole('heading', { name: 'Types' });
  const epicCardBefore = screen.getByText('epic').closest('section')!;
  expect(
    within(epicCardBefore).getByRole('button', { name: 'Task', hidden: true, pressed: true }),
  ).toBeInTheDocument();

  // Simulate what a successful fork produces: the board refetch (queryKey
  // ['board', 'CORE']) comes back with a new schemeId and the copied
  // types/child-type rows re-inserted under fresh ids — the parent that was
  // id 1 is now id 101, its allowed child that was id 2 is now id 102.
  const boardB: Board = {
    ...boardA,
    project: { ...boardA.project, schemeId: 6 },
    types: [
      { id: 101, schemeId: 6, key: 'epic', label: 'Epic', position: 1, config: {}, archivedAt: null },
      { id: 102, schemeId: 6, key: 'task', label: 'Task', position: 2, config: {}, archivedAt: null },
    ],
    childTypes: [{ parentTypeId: 101, childTypeId: 102 }],
  };
  client.setQueryData(['board', 'CORE'], boardB);

  // The scheme banner id flipping to #6 is the signal that the board
  // refetch (with the fresh, fork-produced type ids) has landed.
  await screen.findByText('#6');

  await waitFor(() => {
    const epicCardAfter = screen.getByText('epic').closest('section')!;
    expect(
      within(epicCardAfter).getByRole('button', { name: 'Task', hidden: true, pressed: true }),
    ).toBeInTheDocument();
  });
});

// Regression test for the unhandled-rejection bug: `handleFork` awaited the
// fork POST and the repoint PATCH with no try/catch, so a rejection (either
// call) was an unhandled promise rejection with zero user feedback.
test('surfaces a toast and does not throw when the fork request fails', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const board = makeBoard();
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (url.endsWith('/board')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(board)) });
    }
    if (url.endsWith('/fork')) {
      return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('{"error":"scheme fork failed"}') });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);

  renderSettings();
  await screen.findByRole('heading', { name: 'Types' });

  await userEvent.click(screen.getByRole('button', { name: /Fork for this project/i }));
  await userEvent.click(within(await findForkDialog()).getByRole('button', { name: 'Fork' }));

  expect(await screen.findByText(/Fork failed/i)).toBeInTheDocument();
  // The repoint PATCH must never fire once the fork itself has failed — the
  // board GET also starts with /api/projects/, so match on method+id
  // specifically rather than the shared URL prefix.
  expect(
    fetchMock.mock.calls.some(
      ([url, init]) => url === '/api/projects/1' && (init as RequestInit | undefined)?.method === 'PATCH',
    ),
  ).toBe(false);
});
