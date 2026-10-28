import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import type { Board, Item } from '../api/types';
import { CurrentUserProvider } from '../state/current-user-context';
import { ToastProvider, TooltipProvider } from '@tilewise/ui';
import { indexBoard } from '../utils/index-board';
import { ItemDrawer } from './item-drawer';

// The links in an item's detail that lead to another item: the parent above
// the title, and a linked item's key. Both are buttons drawn as links, so
// each must still be a button by its name, and still open its item.

const createdAt = '2026-01-01T00:00:00.000Z';

function item(id: number, title: string, rest: Partial<Item> = {}): Item {
  return {
    id,
    number: id,
    key: `CORE-${id}`,
    typeId: 1,
    parentId: null,
    createdBy: 7,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
    values: { status: 'backlog', title },
    comments: [],
    links: [],
    ...rest,
  };
}

function makeBoard(): Board {
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 1, itemPrefix: 'CORE', createdAt, repositoryUrl: null, defaultBranch: null },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types: [{ id: 1, schemeId: 1, key: 'bug', label: 'Bug', position: 1, config: {}, archivedAt: null }],
    fields: [
      { id: 10, schemeId: 1, key: 'status', label: 'Status', type: 'option', config: { workflow: true }, optionSetId: 100, archivedAt: null },
      { id: 11, schemeId: 1, key: 'title', label: 'Title', type: 'string', config: {}, optionSetId: null, archivedAt: null },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 11, position: 1, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 10, position: 2, required: true, configOverride: null },
    ],
    options: [
      { id: 1000, optionSetId: 100, value: 'backlog', label: 'Backlog', position: 1, kind: 'todo', config: {}, archivedAt: null },
    ],
    transitions: [],
    linkTypes: [
      { id: 1, itemTypeId: 1, key: 'blocks', label: 'blocks', inverseLabel: 'is blocked by', directional: true, position: 1, archivedAt: null },
    ],
    targetTypes: [],
    views: [],
    childTypes: [],
    items: [
      item(1, 'Pager epic'),
      item(2, 'Fix pagination reset', {
        parentId: 1,
        links: [{ id: 1, linkTypeId: 1, sourceItemId: 2, targetItemId: 3, createdAt }],
      }),
      item(3, 'Migrate field storage'),
    ],
  };
}

async function renderDetailOf(itemId: number) {
  const board = makeBoard();
  const indexes = indexBoard(board);
  const shown = indexes.itemById.get(itemId);
  if (!shown) {
    throw new Error('fixture item missing');
  }
  const onOpenItem = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rootRoute = createRootRoute({
    component: () => (
      <ItemDrawer
        projectKey="core"
        board={board}
        indexes={indexes}
        item={shown}
        onClose={() => {}}
        onOpenItem={onOpenItem}
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
  await screen.findByRole('dialog', { name: 'Item detail' });
  return { onOpenItem };
}

test("the parent's link above the title opens the parent", async () => {
  const { onOpenItem } = await renderDetailOf(2);
  await userEvent.click(screen.getByRole('button', { name: /^CORE-1\s*Pager epic$/ }));
  expect(onOpenItem).toHaveBeenCalledWith('CORE-1');
});

test('an item with no parent shows no parent link', async () => {
  await renderDetailOf(3);
  expect(screen.queryByRole('button', { name: /CORE-1/ })).not.toBeInTheDocument();
});

test("a linked item's key opens the linked item", async () => {
  const { onOpenItem } = await renderDetailOf(2);
  await userEvent.click(screen.getByRole('button', { name: 'CORE-3' }));
  expect(onOpenItem).toHaveBeenCalledWith('CORE-3');
});
