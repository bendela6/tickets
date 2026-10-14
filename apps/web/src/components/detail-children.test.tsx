import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board, Item, ItemType } from '../api/types';
import { CurrentUserProvider } from '../state/current-user-context';
import { ToastProvider, TooltipProvider } from '@bh/ui';
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

test('an item under a parent with no children of its own shows no children section', async () => {
  renderItem(planBoard(), 'TK-80.11');
  await screen.findByRole('dialog', { name: 'Item detail' });

  expect(screen.queryByText('Subtasks')).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: /^Status of / })).not.toBeInTheDocument();
});
