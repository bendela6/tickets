import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@bh/ui';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board, Project } from '../../api/types';
import { CurrentUserProvider } from '../../state/current-user-context';
import { indexBoard } from '../../utils/index-board';
import { RepositoryTab } from './repository-tab';

function makeBoard(project: Partial<Project> = {}): Board {
  return {
    project: {
      id: 1, key: 'core', name: 'Items Core', schemeId: 5, itemPrefix: 'CORE', createdAt: '2026-01-01T00:00:00.000Z',
      repositoryUrl: null, defaultBranch: null, ...project,
    },
    users: [], types: [], fields: [], placements: [], options: [], transitions: [], linkTypes: [], targetTypes: [],
    views: [], childTypes: [], items: [],
  };
}

// PATCH /api/projects/:id answers `reply` (a 2xx with the id, or an error body).
function mockPatch(reply: { status: number; body: unknown }) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({
      ok: reply.status < 400,
      status: reply.status,
      statusText: reply.status < 400 ? 'OK' : 'Bad Request',
      text: () => Promise.resolve(JSON.stringify(reply.body)),
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof mockPatch>) {
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe('/api/projects/1');
  expect(init?.method).toBe('PATCH');
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function renderTab(board: Board, { signedIn = true } = {}) {
  if (signedIn) localStorage.setItem('tickets-user-id', '7');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CurrentUserProvider>
        <RepositoryTab board={board} indexes={indexBoard(board)} projectKey={board.project.key} />
      </CurrentUserProvider>
    </QueryClientProvider>,
    { wrapper: TooltipProvider },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('shows the project\'s link and branch, with Save off until one changes', async () => {
  renderTab(makeBoard({ repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: 'main' }));
  expect(screen.getByRole('heading', { name: 'Repository' })).toBeInTheDocument();
  expect(screen.getByLabelText('Git link')).toHaveValue('https://github.com/bendela6/tickets');
  expect(screen.getByLabelText('Default branch')).toHaveValue('main');
  const save = screen.getByRole('button', { name: 'Save' });
  expect(save).toBeDisabled();

  await userEvent.type(screen.getByLabelText('Default branch'), '-2');
  expect(save).toBeEnabled();
});

test('saves the link and branch, trimmed, and says it is saved', async () => {
  const fetchMock = mockPatch({ status: 200, body: { id: 1 } });
  renderTab(makeBoard());

  await userEvent.type(screen.getByLabelText('Git link'), '  git@github.com:bendela6/tickets.git ');
  await userEvent.type(screen.getByLabelText('Default branch'), 'main');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByRole('status')).toHaveTextContent('saved');
  expect(sentBody(fetchMock)).toMatchObject({
    actorId: 7,
    repositoryUrl: 'git@github.com:bendela6/tickets.git',
    defaultBranch: 'main',
  });
  expect(screen.getByLabelText('Git link')).toHaveValue('git@github.com:bendela6/tickets.git');
});

test('a refused link shows the API\'s message at the Git link field, and the branch field stays clear', async () => {
  mockPatch({
    status: 400,
    body: { error: "invalid command input: repositoryUrl: That's a folder on one machine. Give the git link everyone clones." },
  });
  renderTab(makeBoard());

  const link = screen.getByLabelText('Git link');
  await userEvent.type(link, 'C:/Users/me/tickets');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  const message = await screen.findByRole('alert');
  expect(message).toHaveTextContent("That's a folder on one machine. Give the git link everyone clones.");
  expect(link).toHaveAttribute('aria-invalid', 'true');
  expect(link).toHaveAccessibleDescription("That's a folder on one machine. Give the git link everyone clones.");
  expect(screen.getByLabelText('Default branch')).not.toHaveAttribute('aria-invalid');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  // Editing the link again clears its message.
  await userEvent.type(link, 'x');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(link).not.toHaveAttribute('aria-invalid');
});

test('a refused branch shows its message at the branch field', async () => {
  mockPatch({ status: 400, body: { error: 'invalid command input: defaultBranch: A branch name has no spaces.' } });
  renderTab(makeBoard({ repositoryUrl: 'https://github.com/bendela6/tickets' }));

  await userEvent.type(screen.getByLabelText('Default branch'), 'my branch');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('A branch name has no spaces.');
  expect(screen.getByLabelText('Default branch')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Git link')).not.toHaveAttribute('aria-invalid');
});

test('an error that names neither field shows under the form', async () => {
  mockPatch({ status: 404, body: { error: 'project not found' } });
  renderTab(makeBoard());

  await userEvent.type(screen.getByLabelText('Git link'), 'https://github.com/bendela6/tickets');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('project not found');
  expect(screen.getByLabelText('Git link')).not.toHaveAttribute('aria-invalid');
});

test('clearing the link turns the branch off and clears both', async () => {
  const fetchMock = mockPatch({ status: 200, body: { id: 1 } });
  renderTab(makeBoard({ repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: 'main' }));

  await userEvent.clear(screen.getByLabelText('Git link'));
  expect(screen.getByLabelText('Default branch')).toBeDisabled();
  expect(screen.getByLabelText('Default branch')).toHaveValue('');
  expect(screen.getByText('Give the git link first.')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(sentBody(fetchMock)).toMatchObject({ repositoryUrl: null, defaultBranch: null });
});

test('Enter in a field saves', async () => {
  const fetchMock = mockPatch({ status: 200, body: { id: 1 } });
  renderTab(makeBoard());

  await userEvent.type(screen.getByLabelText('Git link'), 'https://github.com/bendela6/tickets{Enter}');
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(sentBody(fetchMock)).toMatchObject({ repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: null });
});

test('with no one to act as, nothing can be edited', () => {
  renderTab(makeBoard({ repositoryUrl: 'https://github.com/bendela6/tickets' }), { signedIn: false });
  expect(screen.getByLabelText('Git link')).toBeDisabled();
  expect(screen.getByLabelText('Default branch')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});
