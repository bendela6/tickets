import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board, Item, ItemType } from '../api/types';
import { CurrentUserProvider } from '../state/current-user-context';
import { ToastProvider, TooltipProvider } from '@tilewise/ui';
import { indexBoard } from '../utils/index-board';
import { ItemDrawer } from './item-drawer';

const createdAt = '2026-01-01T00:00:00.000Z';

// A board on one scheme: every type places `title` and the workflow's
// `status`; `nesting` is the scheme's item_type_child_types as type keys.
function makeBoard({
  plan,
  prefix,
  typeKeys,
  nesting,
  items,
}: {
  plan: boolean;
  prefix: string;
  typeKeys: string[];
  nesting: Array<[parent: string, child: string]>;
  items: Array<{ id: number; key: string; type: string; parentId: number | null; title: string; status: string }>;
}): Board {
  const types: ItemType[] = typeKeys.map((key, index) => ({
    id: index + 1,
    schemeId: 1,
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    position: index + 1,
    config: {},
    archivedAt: null,
  }));
  const typeId = (key: string) => types.find((type) => type.key === key)!.id;
  return {
    project: { id: 1, key: prefix.toLowerCase(), name: prefix, schemeId: 1, itemPrefix: prefix, createdAt, repositoryUrl: null, defaultBranch: null },
    plan,
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types,
    fields: [
      { id: 10, schemeId: 1, key: 'status', label: 'Status', type: 'option', config: { workflow: true }, optionSetId: 100, archivedAt: null },
      { id: 11, schemeId: 1, key: 'title', label: 'Title', type: 'string', config: {}, optionSetId: null, archivedAt: null },
    ],
    placements: types.flatMap((type) => [
      { itemTypeId: type.id, fieldId: 11, position: 1, required: true, configOverride: null },
      { itemTypeId: type.id, fieldId: 10, position: 2, required: true, configOverride: null },
    ]),
    options: [
      { id: 1000, optionSetId: 100, value: 'todo', label: 'To do', position: 1, kind: 'todo', config: {}, archivedAt: null },
      { id: 1001, optionSetId: 100, value: 'done', label: 'Done', position: 2, kind: 'done', config: {}, archivedAt: null },
    ],
    transitions: [],
    linkTypes: [],
    targetTypes: [],
    views: [],
    childTypes: nesting.map(([parent, child]) => ({ parentTypeId: typeId(parent), childTypeId: typeId(child) })),
    items: items.map(
      (item, index): Item => ({
        id: item.id,
        number: index + 1,
        key: item.key,
        typeId: typeId(item.type),
        parentId: item.parentId,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { title: item.title, status: item.status },
        comments: [],
        links: [],
      }),
    ),
  };
}

// The plan scheme: epic → feature → ticket → subticket, a subticket holding
// subtickets too.
function planBoard(): Board {
  return makeBoard({
    plan: true,
    prefix: 'TK',
    typeKeys: ['epic', 'feature', 'ticket', 'subticket'],
    nesting: [
      ['epic', 'feature'],
      ['feature', 'ticket'],
      ['ticket', 'subticket'],
      ['subticket', 'subticket'],
    ],
    items: [
      { id: 1, key: 'TK/E14', type: 'epic', parentId: null, title: 'Move the plans into tickets', status: 'todo' },
      { id: 2, key: 'TK-80', type: 'feature', parentId: 1, title: 'Add a plan scheme', status: 'todo' },
      { id: 3, key: 'TK-80.11', type: 'ticket', parentId: 2, title: 'Fix children under a parent', status: 'done' },
      { id: 4, key: 'TK-80.12', type: 'ticket', parentId: 2, title: 'Fix the child type', status: 'todo' },
      { id: 5, key: 'TK-80.12.1', type: 'subticket', parentId: 4, title: 'Read the allowed children', status: 'todo' },
    ],
  });
}

function renderItem(board: Board, itemKey: string) {
  const indexes = indexBoard(board);
  const item = indexes.itemByKey.get(itemKey);
  if (!item) {
    throw new Error(`fixture item ${itemKey} missing`);
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rootRoute = createRootRoute({
    component: () => (
      <ItemDrawer
        projectKey={board.project.key}
        board={board}
        indexes={indexes}
        item={item}
        onClose={() => {}}
        onOpenItem={() => {}}
      />
    ),
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <QueryClientProvider client={client}>
      <CurrentUserProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </CurrentUserProvider>
    </QueryClientProvider>,
    { wrapper: TooltipProvider },
  );
}

// A child's row, known by the status select each one carries.
const childStatus = (childKey: string) =>
  screen.queryByRole('combobox', { name: `Status of ${childKey}` });

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('a feature under an epic lists its tickets, with their progress', async () => {
  renderItem(planBoard(), 'TK-80');
  await screen.findByRole('dialog', { name: 'Item detail' });

  expect(screen.getByText('Subtasks')).toBeInTheDocument();
  expect(childStatus('TK-80.11')).toBeInTheDocument();
  expect(screen.getByText('Fix children under a parent')).toBeInTheDocument();
  expect(childStatus('TK-80.12')).toBeInTheDocument();
  expect(screen.getByText('Fix the child type')).toBeInTheDocument();
  expect(screen.getByText('1/2 done')).toBeInTheDocument();
  // a grandchild is its own parent's, not listed here
  expect(childStatus('TK-80.12.1')).not.toBeInTheDocument();
  expect(screen.queryByText('Read the allowed children')).not.toBeInTheDocument();
});

test('a ticket under a feature lists its subtickets', async () => {
  renderItem(planBoard(), 'TK-80.12');
  await screen.findByRole('dialog', { name: 'Item detail' });

  expect(childStatus('TK-80.12.1')).toBeInTheDocument();
  expect(screen.getByText('Read the allowed children')).toBeInTheDocument();
  expect(screen.getByText('0/1 done')).toBeInTheDocument();
});

// The software scheme: an epic holds tasks, bugs and spikes, a task subtasks;
// a bug and a spike hold nothing. CORE-7 is a subtask left under a bug from
// before that rule.
function softwareBoard(): Board {
  return makeBoard({
    plan: false,
    prefix: 'CORE',
    typeKeys: ['epic', 'task', 'bug', 'spike', 'subtask'],
    nesting: [
      ['epic', 'task'],
      ['epic', 'bug'],
      ['epic', 'spike'],
      ['task', 'subtask'],
    ],
    items: [
      { id: 11, key: 'CORE-1', type: 'epic', parentId: null, title: 'Speed up the board', status: 'todo' },
      { id: 12, key: 'CORE-2', type: 'task', parentId: 11, title: 'Virtualize the rows', status: 'todo' },
      { id: 13, key: 'CORE-3', type: 'subtask', parentId: 12, title: 'Measure the scroll', status: 'todo' },
      { id: 14, key: 'CORE-4', type: 'bug', parentId: null, title: 'Rows jump on resize', status: 'todo' },
      { id: 15, key: 'CORE-6', type: 'bug', parentId: null, title: 'Offsets reset', status: 'todo' },
      { id: 16, key: 'CORE-7', type: 'subtask', parentId: 15, title: 'Repro harness', status: 'done' },
    ],
  });
}

function mockCreate() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({ id: 900, number: 99, key: 'NEW-1' })),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// What the add row posted: the new item's type and parent.
async function created(fetchMock: ReturnType<typeof mockCreate>) {
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(String(init.body)) as { typeKey: string; parentId: number; values: unknown };
  return { url, method: init.method, typeKey: body.typeKey, parentId: body.parentId, values: body.values };
}

test('adding a child to a feature makes a ticket', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const fetchMock = mockCreate();
  renderItem(planBoard(), 'TK-80');
  await screen.findByRole('dialog', { name: 'Item detail' });

  // one type a feature holds, so no type to pick
  expect(screen.queryByRole('combobox', { name: 'Child type' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Add subtask' })).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('textbox', { name: 'Add ticket' }), 'Fix the picker{Enter}');

  expect(await created(fetchMock)).toEqual({
    url: '/api/projects/tk/items',
    method: 'POST',
    typeKey: 'ticket',
    parentId: 2,
    values: { title: 'Fix the picker' },
  });
});

test('a ticket with no subtickets yet shows the row that adds one, and it makes a subticket', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const fetchMock = mockCreate();
  renderItem(planBoard(), 'TK-80.11');
  await screen.findByRole('dialog', { name: 'Item detail' });

  expect(screen.getByText('Subtasks')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: /^Status of / })).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('textbox', { name: 'Add subticket' }), 'Write the test{Enter}');

  const post = await created(fetchMock);
  expect(post.typeKey).toBe('subticket');
  expect(post.parentId).toBe(3);
});

test('an epic holding several types offers them, the first until another is picked', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const fetchMock = mockCreate();
  renderItem(softwareBoard(), 'CORE-1');
  await screen.findByRole('dialog', { name: 'Item detail' });

  const childType = screen.getByRole('combobox', { name: 'Child type' });
  expect(childType).toHaveTextContent('Task');
  expect(screen.getByRole('textbox', { name: 'Add task' })).toBeInTheDocument();

  await userEvent.click(childType);
  expect(await screen.findAllByRole('option')).toHaveLength(3);
  expect(screen.getByRole('option', { name: 'Task' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('option', { name: 'Spike' })).toBeInTheDocument();
  // only what an epic holds: never another epic, nor a subtask
  expect(screen.queryByRole('option', { name: 'Subtask' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Epic' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('option', { name: 'Bug' }));

  expect(screen.getByRole('combobox', { name: 'Child type' })).toHaveTextContent('Bug');
  await userEvent.type(screen.getByRole('textbox', { name: 'Add bug' }), 'Header flickers{Enter}');

  const post = await created(fetchMock);
  expect(post.typeKey).toBe('bug');
  expect(post.parentId).toBe(11);
});

test('a refused child keeps its title and says why', async () => {
  localStorage.setItem('tickets-user-id', '7');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: () => Promise.resolve(JSON.stringify({ error: '"todo" is not a valid starting option' })),
    }),
  );
  renderItem(softwareBoard(), 'CORE-1');
  await screen.findByRole('dialog', { name: 'Item detail' });

  const input = screen.getByRole('textbox', { name: 'Add task' });
  await userEvent.type(input, 'Header flickers{Enter}');

  expect(await screen.findByText('"todo" is not a valid starting option')).toBeInTheDocument();
  expect(input).toHaveValue('Header flickers');
});

test("a software project's task still adds a subtask", async () => {
  localStorage.setItem('tickets-user-id', '7');
  const fetchMock = mockCreate();
  renderItem(softwareBoard(), 'CORE-2');
  await screen.findByRole('dialog', { name: 'Item detail' });

  expect(childStatus('CORE-3')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Child type' })).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('textbox', { name: 'Add subtask' }), 'Profile it{Enter}');

  const post = await created(fetchMock);
  expect(post.typeKey).toBe('subtask');
  expect(post.parentId).toBe(12);
});

test('an item whose type holds nothing, with no children, shows no children section', async () => {
  renderItem(softwareBoard(), 'CORE-4');
  await screen.findByRole('dialog', { name: 'Item detail' });

  expect(screen.queryByText('Subtasks')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: /^Add / })).not.toBeInTheDocument();
});

test('an item whose type holds nothing still lists the children it has, with no add row', async () => {
  renderItem(softwareBoard(), 'CORE-6');
  await screen.findByRole('dialog', { name: 'Item detail' });

  expect(childStatus('CORE-7')).toBeInTheDocument();
  expect(screen.getByText('1/1 done')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: /^Add / })).not.toBeInTheDocument();
});
