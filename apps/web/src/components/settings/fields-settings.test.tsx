import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board } from '../../api/types';
import { indexBoard } from '../../utils/index-board';
import { FieldsSettings } from './fields-settings';

function makeBoard(): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', ticketPrefix: 'CORE', createdAt },
    users: [],
    types: [
      {
        id: 1,
        projectId: 1,
        key: 'task',
        label: 'Task',
        config: {},
        position: 1,
        archivedAt: null,
        createdAt,
      },
    ],
    typeFields: [
      { ticketTypeId: 1, fieldId: 11, position: 1, required: true },
      { ticketTypeId: 1, fieldId: 12, position: 2, required: false },
    ],
    statuses: [],
    transitions: [],
    fields: [
      {
        id: 11,
        projectId: 1,
        key: 'title',
        label: 'Title',
        type: 'text',
        system: true,
        config: {},
        archivedAt: null,
        createdAt,
        options: [],
      },
      {
        id: 12,
        projectId: 1,
        key: 'severity',
        label: 'Severity',
        type: 'select',
        system: false,
        config: {},
        archivedAt: null,
        createdAt,
        options: [
          {
            id: 1,
            value: 's1',
            label: 'S1 · page on fire',
            config: { color: '#a03028' },
            position: 1,
            archivedAt: null,
          },
          { id: 2, value: 's2', label: 'S2 · degraded', config: {}, position: 2, archivedAt: null },
        ],
      },
      {
        id: 13,
        projectId: 1,
        key: 'legacy_flag',
        label: 'Legacy flag',
        type: 'boolean',
        system: false,
        config: {},
        archivedAt: '2026-02-01T00:00:00.000Z',
        createdAt,
        options: [],
      },
    ],
    linkTypes: [],
    views: [],
    tickets: [],
  };
}

function renderFields() {
  const board = makeBoard();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <FieldsSettings board={board} indexes={indexBoard(board)} projectKey="core" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('renders the fields table from the board; archived fields hide behind the toggle', async () => {
  renderFields();

  // header meta counts all fields including archived
  expect(screen.getByText('3 fields · 1 archived')).toBeInTheDocument();

  // active rows: label, key mono, type, option chips
  expect(screen.getByText('Title')).toBeInTheDocument();
  expect(screen.getByText('title')).toBeInTheDocument();
  expect(screen.getByText('Severity')).toBeInTheDocument();
  expect(screen.getByText('severity')).toBeInTheDocument();
  expect(screen.getByText('select')).toBeInTheDocument();
  expect(screen.getByText('S1 · page on fire')).toBeInTheDocument();

  // archived field only appears once "Show archived" is on
  expect(screen.queryByText('Legacy flag')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('switch', { name: 'Show archived' }));
  expect(screen.getByText('Legacy flag')).toBeInTheDocument();
  expect(screen.getByText('ARCH')).toBeInTheDocument();
});

test('row click expands the inline editor with key/type locked and options listed', async () => {
  renderFields();

  await userEvent.click(screen.getByRole('button', { name: /severity/i }));

  expect(screen.getByLabelText('Label')).toHaveValue('Severity');
  expect(screen.getByDisplayValue('severity 🔒')).toBeDisabled();
  expect(screen.getByDisplayValue('select 🔒')).toBeDisabled();
  expect(screen.getByLabelText('Option s1 label')).toHaveValue('S1 · page on fire');
  expect(screen.getByText('＋ Add option')).toBeInTheDocument();
});

test('new field composer POSTs the right body', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () =>
      Promise.resolve(
        JSON.stringify({
          id: 20,
          projectId: 1,
          key: 'story_points',
          label: 'Story points',
          type: 'number',
          system: false,
          config: {},
          archivedAt: null,
          createdAt: '2026-03-01T00:00:00.000Z',
        }),
      ),
  });
  vi.stubGlobal('fetch', fetchMock);
  renderFields();

  await userEvent.click(screen.getByRole('button', { name: '＋ New field' }));
  await userEvent.type(screen.getByLabelText('Label'), 'Story points');
  // key auto-slugs from the label
  expect(screen.getByLabelText('Key')).toHaveValue('story_points');

  // pick the type from the combobox
  await userEvent.click(screen.getByRole('button', { name: 'text' }));
  await userEvent.click(await screen.findByRole('option', { name: 'number' }));

  await userEvent.click(screen.getByRole('button', { name: 'Create field' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/projects/core/fields');
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({
    key: 'story_points',
    label: 'Story points',
    type: 'number',
  });

  // composer closes after a successful create
  await waitFor(() => expect(screen.queryByText('Create field')).not.toBeInTheDocument());
});
