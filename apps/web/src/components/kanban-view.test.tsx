import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board } from '../api/types';
import { CurrentUserProvider } from '../state/current-user-context';
import { indexBoard } from '../utils/index-board';
import { KanbanView } from './kanban-view';

function makeBoard(): Board {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 1, itemPrefix: 'CORE', createdAt },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types: [
      {
        id: 1,
        schemeId: 1,
        key: 'task',
        label: 'Task',
        position: 1,
        config: {},
        archivedAt: null,
      },
    ],
    fields: [
      {
        id: 10,
        schemeId: 1,
        key: 'status',
        label: 'Status',
        type: 'option',
        config: { workflow: true },
        optionSetId: 1,
        archivedAt: null,
      },
      {
        id: 11,
        schemeId: 1,
        key: 'title',
        label: 'Title',
        type: 'string',
        config: {},
        optionSetId: null,
        archivedAt: null,
      },
      {
        id: 12,
        schemeId: 1,
        key: 'priority',
        label: 'Priority',
        type: 'option',
        config: {},
        optionSetId: 2,
        archivedAt: null,
      },
      {
        id: 13,
        schemeId: 1,
        key: 'assignee',
        label: 'Assignee',
        type: 'user',
        config: {},
        optionSetId: null,
        archivedAt: null,
      },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 10, position: 1, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 11, position: 2, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 12, position: 3, required: false, configOverride: null },
      { itemTypeId: 1, fieldId: 13, position: 4, required: false, configOverride: null },
    ],
    // one shared status set (optionSetId 1); priority is its own set (2)
    options: [
      {
        id: 1,
        optionSetId: 1,
        value: 'backlog',
        label: 'Backlog',
        position: 1,
        kind: 'todo',
        config: {},
        archivedAt: null,
      },
      {
        id: 2,
        optionSetId: 1,
        value: 'in-review',
        label: 'In review',
        position: 2,
        kind: 'active',
        config: {},
        archivedAt: null,
      },
      {
        id: 3,
        optionSetId: 1,
        value: 'shipped',
        label: 'Shipped',
        position: 3,
        kind: 'done',
        config: {},
        archivedAt: null,
      },
      {
        id: 4,
        optionSetId: 2,
        value: 'p2',
        label: 'P2',
        position: 1,
        kind: null,
        config: { color: '#fab219' },
        archivedAt: null,
      },
    ],
    // only backlog → in-review is a legal move
    transitions: [{ id: 1, fieldId: 10, itemTypeId: null, fromOptionId: 1, toOptionId: 2, config: null }],
    linkTypes: [],
    targetTypes: [],
    views: [],
    childTypes: [],
    items: [
      {
        id: 100,
        number: 121,
        typeId: 1,
        parentId: null,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: {
          status: 'backlog',
          title: 'Keyboard nav for board mode',
          priority: 'p2',
          assignee: 7,
        },
        comments: [],
        links: [],
      },
      {
        id: 101,
        number: 122,
        typeId: 1,
        parentId: null,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { status: 'in-review', title: 'Ship the drop slots' },
        comments: [],
        links: [],
      },
    ],
  };
}

function renderKanban() {
  const board = makeBoard();
  const onOpenTicket = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CurrentUserProvider>
        <KanbanView
          board={board}
          indexes={indexBoard(board)}
          rows={board.items}
          projectKey="CORE"
          onOpenTicket={onOpenTicket}
        />
      </CurrentUserProvider>
    </QueryClientProvider>,
  );
  return { onOpenTicket };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('renders one column per workflow option and groups items by values[status]', () => {
  renderKanban();
  const backlog = screen.getByRole('region', { name: 'Backlog' });
  const review = screen.getByRole('region', { name: 'In review' });
  const shipped = screen.getByRole('region', { name: 'Shipped' });
  expect(within(backlog).getByText('CORE-121')).toBeInTheDocument();
  expect(within(backlog).queryByText('CORE-122')).not.toBeInTheDocument();
  expect(within(review).getByText('CORE-122')).toBeInTheDocument();
  expect(within(shipped).queryByText(/CORE-/)).not.toBeInTheDocument();
  // column counts
  expect(within(backlog).getByText('1')).toBeInTheDocument();
  expect(within(shipped).getByText('0')).toBeInTheDocument();
});

test('column glyph tint follows the option kind', () => {
  renderKanban();
  const backlog = screen.getByRole('region', { name: 'Backlog' });
  const review = screen.getByRole('region', { name: 'In review' });
  const shipped = screen.getByRole('region', { name: 'Shipped' });
  expect(backlog.querySelector('.text-kind-todo')).not.toBeNull();
  expect(review.querySelector('.text-kind-active')).not.toBeNull();
  expect(shipped.querySelector('.text-kind-done')).not.toBeNull();
});

test('card shows the type badge', () => {
  renderKanban();
  const backlog = screen.getByRole('region', { name: 'Backlog' });
  expect(within(backlog).getByText('Task')).toBeInTheDocument();
});

// Regression: the assignee field is type 'user', not 'option' — the card
// footer must resolve it through indexes.userById rather than the option set.
test('card shows the assignee avatar for a user-typed field', () => {
  renderKanban();
  const backlog = screen.getByRole('region', { name: 'Backlog' });
  expect(within(backlog).getByTitle('Mara K')).toBeInTheDocument();
});

test('clicking a card opens the ticket', async () => {
  const { onOpenTicket } = renderKanban();
  await userEvent.click(screen.getByRole('button', { name: /keyboard nav for board mode/i }));
  expect(onOpenTicket).toHaveBeenCalledWith(121);
});

test('dragging highlights legal targets, dims illegal ones, ghosts the origin', () => {
  localStorage.setItem('tickets-user-id', '7');
  renderKanban();
  fireEvent.dragStart(screen.getByRole('button', { name: /keyboard nav for board mode/i }));
  expect(screen.getByText('Drop — Backlog → In review')).toBeInTheDocument();
  expect(screen.getByText(/no transition Backlog → Shipped/)).toBeInTheDocument();
  expect(screen.getByText('CORE-121 — dragging…')).toBeInTheDocument();
});

test('dropping on a legal column PATCHes the status', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({ id: 100, updatedAt: 'later' })),
  });
  vi.stubGlobal('fetch', fetchMock);
  renderKanban();
  fireEvent.dragStart(screen.getByRole('button', { name: /keyboard nav for board mode/i }));
  fireEvent.drop(screen.getByRole('region', { name: 'In review' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/items/100');
  expect(init.method).toBe('PATCH');
  // the mutation envelope carries a random commandId — destructure it out
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(rest).toMatchObject({
    actorId: 7,
    expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    values: { status: 'in-review' },
  });
});
