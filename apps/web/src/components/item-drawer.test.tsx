import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Board } from '../api/types';
import { CurrentUserProvider } from '../state/current-user-context';
import { ToastProvider } from '@tickets/ui';
import { indexBoard } from '../utils/index-board';
import { ItemDrawer } from './item-drawer';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const createdAt = '2026-01-01T00:00:00.000Z';

function makeBoard(): Board {
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 1, itemPrefix: 'CORE', createdAt },
    users: [
      { id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null },
      { id: 8, name: 'claude-worker', email: null, kind: 'agent', archivedAt: null },
    ],
    types: [{ id: 1, schemeId: 1, key: 'bug', label: 'Bug', position: 1, config: {}, archivedAt: null }],
    fields: [
      {
        id: 10,
        schemeId: 1,
        key: 'status',
        label: 'Status',
        type: 'option',
        config: { workflow: true },
        optionSetId: 100,
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
        optionSetId: 200,
        archivedAt: null,
      },
      {
        id: 13,
        schemeId: 1,
        key: 'description',
        label: 'Description',
        type: 'string',
        config: { format: 'markdown' },
        optionSetId: null,
        archivedAt: null,
      },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 11, position: 1, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 10, position: 2, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 12, position: 3, required: false, configOverride: null },
      { itemTypeId: 1, fieldId: 13, position: 4, required: false, configOverride: null },
    ],
    options: [
      { id: 1000, optionSetId: 100, value: 'backlog', label: 'Backlog', position: 1, kind: 'todo', config: {}, archivedAt: null },
      { id: 1001, optionSetId: 100, value: 'in-review', label: 'In review', position: 2, kind: 'active', config: {}, archivedAt: null },
      { id: 2000, optionSetId: 200, value: 'p0', label: 'P0 · critical', position: 1, kind: null, config: { color: '#a03028' }, archivedAt: null },
    ],
    transitions: [],
    linkTypes: [
      {
        id: 1,
        itemTypeId: 1,
        key: 'blocks',
        label: 'blocks',
        inverseLabel: 'is blocked by',
        directional: true,
        position: 1,
        archivedAt: null,
      },
    ],
    targetTypes: [],
    views: [],
    childTypes: [],
    items: [
      {
        id: 100,
        number: 128,
        typeId: 1,
        parentId: null,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: {
          status: 'backlog',
          title: 'Fix pagination reset on column resize',
          priority: 'p0',
          description: 'rowVirtualizer loses its offset cache.',
        },
        comments: [
          {
            id: 1,
            itemId: 100,
            authorId: 7,
            parentId: null,
            body: 'Repro’d on staging with 300 rows.',
            createdAt,
          },
        ],
        links: [{ id: 1, linkTypeId: 1, sourceItemId: 100, targetItemId: 102, createdAt }],
      },
      {
        id: 101,
        number: 129,
        typeId: 1,
        parentId: 100,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { status: 'in-review', title: 'Repro harness for virtualizer offsets' },
        comments: [],
        links: [],
      },
      {
        id: 102,
        number: 131,
        typeId: 1,
        parentId: null,
        createdBy: 7,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
        values: { status: 'backlog', title: 'Migrate field storage to JSONB' },
        comments: [],
        links: [],
      },
    ],
  };
}

async function renderDrawer() {
  const board = makeBoard();
  const indexes = indexBoard(board);
  const item = indexes.itemByNumber.get(128);
  if (!item) {
    throw new Error('fixture item missing');
  }
  const onClose = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // ItemDetail uses router links/navigation, so the drawer mounts inside a
  // minimal memory router.
  const rootRoute = createRootRoute({
    component: () => (
      <ItemDrawer
        projectKey="core"
        board={board}
        indexes={indexes}
        item={item}
        onClose={onClose}
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
  );
  await screen.findByRole('dialog', { name: 'Item detail' });
  return { onClose };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('renders key, title, fields, subtasks, links and comments from the board', async () => {
  await renderDrawer();
  // header: key chip + type badge + status select
  expect(screen.getByText('CORE-128')).toBeInTheDocument();
  expect(screen.getByText('Bug')).toBeInTheDocument();
  expect(screen.getAllByText('Backlog').length).toBeGreaterThan(0);
  // title (click-to-edit button)
  expect(
    screen.getByRole('button', { name: /fix pagination reset on column resize/i }),
  ).toBeInTheDocument();
  // fields grid: label + select value
  expect(screen.getByText('Priority')).toBeInTheDocument();
  expect(screen.getByText('P0 · critical')).toBeInTheDocument();
  // subtasks: row with key, title and progress header
  expect(screen.getByText('CORE-129')).toBeInTheDocument();
  expect(screen.getByText('Repro harness for virtualizer offsets')).toBeInTheDocument();
  expect(screen.getByText('0/1 done')).toBeInTheDocument();
  expect(screen.getByText('In review')).toBeInTheDocument();
  // links: direction chip + other item
  expect(screen.getByText('blocks →')).toBeInTheDocument();
  expect(screen.getByText('CORE-131')).toBeInTheDocument();
  // comments tab content
  expect(screen.getByText('Repro’d on staging with 300 rows.')).toBeInTheDocument();
  expect(screen.getByText('Mara K')).toBeInTheDocument();
});

test('drawer is 620px wide, capped to leave a tap-to-close strip', async () => {
  await renderDrawer();
  const panel = screen.getByRole('dialog', { name: 'Item detail' });
  expect(panel.style.getPropertyValue('--panel-w')).toBe('min(620px, 100vw - 3rem)');
});

test('maximizing fills the viewport and restores', async () => {
  await renderDrawer();
  await userEvent.click(screen.getByRole('button', { name: 'Maximize' }));
  const panel = screen.getByRole('dialog', { name: 'Item detail' });
  expect(panel.style.getPropertyValue('--panel-w')).toBe('calc(100vw - 3rem)');
  await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
  expect(panel.style.getPropertyValue('--panel-w')).toBe('min(620px, 100vw - 3rem)');
});

test('escape closes the drawer', async () => {
  const { onClose } = await renderDrawer();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

// The drawer is a modal radix layer, and tiptap mounts its @/# popover as a
// <body> child — outside the portal radix re-grants pointer events to. That
// left the rows inert, and the press that fell through them landed on <html>,
// which the drawer read as a click on the page behind it and closed on,
// discarding the draft. Keyboard picking never touched either path, which is
// why nothing caught it.
const descriptionEditor = () =>
  Array.from(document.querySelectorAll('[contenteditable="true"]')).find((el) =>
    el.textContent?.includes('rowVirtualizer'),
  ) as HTMLElement;

const suggestionPopover = () =>
  document.querySelector('[data-suggestion-popover]') as HTMLElement | null;

test('a mention can be picked with the mouse from inside the drawer, and picking one does not close it', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const user = userEvent.setup();
  const { onClose } = await renderDrawer();

  await user.click(descriptionEditor());
  await user.keyboard('@Mar');
  const popover = await waitFor(() => {
    const node = suggestionPopover();
    if (!node) throw new Error('suggestion popover never opened');
    return node;
  });

  // Fails outright without the fix: the popover inherits `pointer-events: none`
  // from <body>, so userEvent refuses the click exactly as a real pointer would
  // sail past it.
  await user.click(within(popover).getByText('Mara K'));

  expect(document.querySelector('[data-mention="Mara K"]')).not.toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Item detail' })).toBeInTheDocument();
});

test('a press-and-release inside the suggestion popover is not an interaction outside the drawer', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const user = userEvent.setup();
  const { onClose } = await renderDrawer();

  await user.click(descriptionEditor());
  await user.keyboard('@Mar');
  const popover = await waitFor(() => {
    const node = suggestionPopover();
    if (!node) throw new Error('suggestion popover never opened');
    return node;
  });

  // Press and release inside the popover without picking a row — dragging
  // across the list, or grabbing its chrome. What keeps the drawer open is
  // that radix classifies an interaction by the React tree rather than the
  // DOM, and tiptap's ReactRenderer portals the popover out of the editor
  // that is inside the drawer; a popover mounted as its own React root would
  // dismiss the drawer here. Radix defers a modal dialog's outside dismissal
  // from the pointerdown to the click that follows, so both halves have to be
  // delivered — with fireEvent, because userEvent moves focus on mousedown,
  // which blurs the editor and tears the popover down first.
  fireEvent.pointerDown(popover);
  fireEvent.click(popover);

  expect(suggestionPopover()).not.toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Item detail' })).toBeInTheDocument();
});

test('editing the title PATCHes /api/items/:id with a commandId envelope', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({ id: 100, updatedAt: 'later' })),
  });
  vi.stubGlobal('fetch', fetchMock);
  await renderDrawer();
  await userEvent.click(
    screen.getByRole('button', { name: /fix pagination reset on column resize/i }),
  );
  const input = screen.getByRole('textbox', { name: 'Title' });
  fireEvent.change(input, { target: { value: 'Fix virtualizer offset cache' } });
  fireEvent.blur(input);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/items/100');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({
    actorId: 7,
    expectedUpdatedAt: createdAt,
    values: { title: 'Fix virtualizer offset cache' },
  });
});

test('changing the status select PATCHes the workflow field key', async () => {
  localStorage.setItem('tickets-user-id', '7');
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({ id: 100, updatedAt: 'later' })),
  });
  vi.stubGlobal('fetch', fetchMock);
  await renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Backlog' }));
  await userEvent.click(await screen.findByRole('option', { name: /in review/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/items/100');
  expect(init.method).toBe('PATCH');
  const { commandId, ...rest } = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(typeof commandId).toBe('string');
  expect(commandId).toMatch(UUID_RE);
  expect(rest).toEqual({
    actorId: 7,
    expectedUpdatedAt: createdAt,
    values: { status: 'in-review' },
  });
});

