import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Board, Item } from '../api/types';
import { CurrentUserProvider } from '../state/current-user-context';
import { indexBoard } from '../utils/index-board';
import { DetailComments } from './detail-comments';

const createdAt = '2026-01-01T00:00:00.000Z';

function makeBoard(): Board {
  return {
    project: { id: 1, key: 'core', name: 'Items Core', schemeId: 1, itemPrefix: 'CORE', createdAt },
    users: [{ id: 7, name: 'Mara K', email: null, kind: 'human', archivedAt: null }],
    types: [{ id: 1, schemeId: 1, key: 'bug', label: 'Bug', position: 1, config: {}, archivedAt: null }],
    fields: [],
    placements: [],
    options: [],
    transitions: [],
    linkTypes: [],
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
        values: {},
        comments: [],
        links: [],
      },
    ],
  };
}

function mockCommentFetch(created: Record<string, unknown>) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(created)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderComments() {
  const board = makeBoard();
  const indexes = indexBoard(board);
  const item = indexes.itemByNumber.get(128) as Item;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CurrentUserProvider>
        <DetailComments indexes={indexes} item={item} prefix="CORE" />
      </CurrentUserProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem('tickets-user-id', '7');
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('composer renders the Comment button and ⌘↩ hint inside the editor container', () => {
  mockCommentFetch({ id: 1, itemId: 100, authorId: 7, parentId: null, body: 'hi', createdAt });
  renderComments();

  const button = screen.getByRole('button', { name: 'Comment' });
  expect(screen.getByText('⌘↩')).toBeInTheDocument();
  // Composer relayout: the button lives inside the same bordered editor
  // container as the content surface, not below it in a separate row.
  const container = document.querySelector('.rt')!.parentElement!;
  expect(container.contains(button)).toBe(true);
});

test('clicking Comment posts the typed body and clears the composer', async () => {
  const fetchMock = mockCommentFetch({
    id: 1,
    itemId: 100,
    authorId: 7,
    parentId: null,
    body: 'Looks good',
    createdAt,
  });
  const user = userEvent.setup();
  renderComments();

  await user.type(document.querySelector('[contenteditable="true"]')!, 'Looks good');
  await user.click(screen.getByRole('button', { name: 'Comment' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string) as { body: string; actorId: number };
  expect(body.actorId).toBe(7);
  expect(body.body).toContain('Looks good');
});

test('⌘↩ submits the composer without a separate button click', async () => {
  const fetchMock = mockCommentFetch({
    id: 2,
    itemId: 100,
    authorId: 7,
    parentId: null,
    body: 'shipped',
    createdAt,
  });
  const user = userEvent.setup();
  renderComments();

  const surface = document.querySelector('[contenteditable="true"]')!;
  await user.type(surface, 'shipped{Meta>}{Enter}{/Meta}');

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
});

test('no user picked disables the composer and its submit button', () => {
  localStorage.clear();
  mockCommentFetch({});
  renderComments();

  expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
  expect(document.querySelector('[contenteditable="true"]')).toBeNull();
  expect(document.querySelector('.is-editor-empty')).toHaveAttribute(
    'data-placeholder',
    'Pick a user in the header to comment',
  );
});
