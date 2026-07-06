import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board } from '../../api/types';
import { indexBoard } from '../../utils/index-board';
import { UsersSettings } from './users-settings';

function makeBoard(): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', ticketPrefix: 'CORE', createdAt },
    users: [
      { id: 7, name: 'Mara K', email: 'mara@acme.dev', kind: 'human', archivedAt: null, createdAt },
      {
        id: 8,
        name: 'scout',
        email: null,
        kind: 'agent',
        archivedAt: '2026-02-01T00:00:00.000Z',
        createdAt,
      },
    ],
    types: [],
    typeFields: [],
    statuses: [],
    transitions: [],
    fields: [],
    linkTypes: [],
    views: [],
    tickets: [],
  };
}

function renderUsers() {
  const board = makeBoard();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <UsersSettings board={board} indexes={indexBoard(board)} projectKey="core" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('renders the user roster with kind chips and archived marker', () => {
  renderUsers();
  expect(screen.getByText('Mara K')).toBeInTheDocument();
  expect(screen.getByText('mara@acme.dev')).toBeInTheDocument();
  expect(screen.getByText('scout')).toBeInTheDocument();
  // no email → em dash
  expect(screen.getByText('—')).toBeInTheDocument();
  // kind chips
  expect(screen.getByText('human')).toBeInTheDocument();
  expect(screen.getByText('agent')).toBeInTheDocument();
  // archived agent is marked
  expect(screen.getByText('ARCH')).toBeInTheDocument();
  // header count
  expect(screen.getByText('2 users · 1 archived')).toBeInTheDocument();
});

test('composer POSTs name + kind to /api/users', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () =>
      Promise.resolve(
        JSON.stringify({
          id: 9,
          name: 'Rex',
          email: null,
          kind: 'human',
          archivedAt: null,
          createdAt: '2026-03-01T00:00:00.000Z',
        }),
      ),
  });
  vi.stubGlobal('fetch', fetchMock);
  renderUsers();

  await userEvent.click(screen.getByRole('button', { name: /new user/i }));
  await userEvent.type(screen.getByLabelText('Name'), 'Rex');
  await userEvent.click(screen.getByRole('button', { name: 'Create user' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/users');
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({ name: 'Rex', kind: 'human' });

  // success clears the draft for the next entry
  await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
});
