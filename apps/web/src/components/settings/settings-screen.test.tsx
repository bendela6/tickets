import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Board } from '../../api/types';
import { SettingsScreen } from './settings-screen';

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
    views: [],
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

function renderWithProviders(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
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
