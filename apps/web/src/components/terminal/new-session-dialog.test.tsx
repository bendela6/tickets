import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NewSessionDialog } from './new-session-dialog';

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

// Empty workdir list by default → the dialog opens straight into add-workdir
// mode, so the directory tree (and thus the name-seed flow) is on screen.
function mockFetch(workdirs: unknown[] = []) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const u = String(url);
    if (u.endsWith('/api/workdirs') && init?.method === 'POST') {
      return new Response(JSON.stringify({ id: 7, name: 'x', path: '/home/me' }), { status: 201 });
    }
    if (u.includes('/api/workdirs/roots')) {
      return new Response(JSON.stringify([{ path: '/home/me', symbol: '~', annotation: 'home' }]), {
        status: 200,
      });
    }
    if (u.includes('/api/workdirs/dirs')) {
      return new Response(JSON.stringify({ path: '/home/me', parent: '/home', entries: [] }), {
        status: 200,
      });
    }
    if (u.includes('/api/terminal/sessions')) {
      return new Response(JSON.stringify({ id: 42 }), { status: 201 });
    }
    if (u.endsWith('/api/workdirs')) {
      return new Response(JSON.stringify(workdirs), { status: 200 });
    }
    return new Response('null', { status: 200 });
  });
}

beforeEach(() => {
  mockFetch();
});
afterEach(() => vi.restoreAllMocks());

describe('NewSessionDialog', () => {
  it('Start is disabled until a folder is picked and a name is present', async () => {
    render(
      <Wrap>
        <NewSessionDialog open onOpenChange={() => {}} onCreated={() => {}} />
      </Wrap>,
    );
    const start = screen.getByRole('button', { name: /start session/i });
    expect(start).toBeDisabled();

    // Picking a folder both fills the path and seeds the name from its basename.
    await userEvent.click(await screen.findByRole('treeitem', { name: /~/ }));
    expect(screen.getByPlaceholderText('tickets')).toHaveValue('me');
    expect(start).toBeEnabled();
  });

  it('stops seeding the name once the user edits it', async () => {
    render(
      <Wrap>
        <NewSessionDialog open onOpenChange={() => {}} onCreated={() => {}} />
      </Wrap>,
    );
    await userEvent.click(await screen.findByRole('treeitem', { name: /~/ }));

    const nameInput = screen.getByPlaceholderText('tickets');
    expect(nameInput).toHaveValue('me');

    // User overrides the seeded name.
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'custom');
    expect(nameInput).toHaveValue('custom');

    // Choosing a different folder must NOT overwrite the edited name.
    const pathInput = screen.getByPlaceholderText(/absolute path/i);
    await userEvent.clear(pathInput);
    await userEvent.type(pathInput, '/srv/app');
    expect(nameInput).toHaveValue('custom');
  });

  it('creates the workdir then the session and hands back the new id', async () => {
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <Wrap>
        <NewSessionDialog open onOpenChange={onOpenChange} onCreated={onCreated} />
      </Wrap>,
    );

    await userEvent.click(await screen.findByRole('treeitem', { name: /~/ }));
    await userEvent.click(screen.getByRole('button', { name: /start session/i }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(42));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('lets the user pick an existing workdir instead of adding one', async () => {
    vi.restoreAllMocks();
    mockFetch([{ id: 3, name: 'tickets', path: '/home/me/work/tickets', runner: 'local' }]);
    render(
      <Wrap>
        <NewSessionDialog open onOpenChange={() => {}} onCreated={() => {}} />
      </Wrap>,
    );

    // With a saved workdir present, the dialog starts in pick mode (combobox,
    // no directory tree). Start is gated on a selection.
    const start = await screen.findByRole('button', { name: /start session/i });
    expect(start).toBeDisabled();
    // Pick mode: the combobox toggle is shown and there is no directory tree.
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
    expect(screen.getByText('＋ New workdir')).toBeInTheDocument();
  });

  it('submits a picked workdir straight to session-create, without creating a workdir', async () => {
    vi.restoreAllMocks();
    const fetchSpy = mockFetch([
      {
        id: 3,
        name: 'saved',
        path: '/home/me/saved',
        runner: 'local',
        containerName: null,
        gitRemote: null,
        defaultBranch: null,
        config: {},
        archivedAt: null,
        createdAt: '2026-01-01',
      },
    ]);
    const onCreated = vi.fn();
    render(
      <Wrap>
        <NewSessionDialog open onOpenChange={() => {}} onCreated={onCreated} />
      </Wrap>,
    );

    const start = await screen.findByRole('button', { name: /start session/i });
    expect(start).toBeDisabled();

    // The combobox trigger sits in a <label> alongside the "New workdir"
    // toggle, which folds both into one ambiguous accessible name — so open
    // it via its visible placeholder text rather than an accessible-name
    // role query (see the sibling toggle button below for the same pattern).
    await userEvent.click(await screen.findByText('Select a workdir…'));
    await userEvent.click(await screen.findByRole('option', { name: /saved/i }));
    expect(start).toBeEnabled();

    await userEvent.click(start);

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(42));

    const createWorkdirCalls = fetchSpy.mock.calls.filter(([url, init]) => {
      const reqInit = init as RequestInit | undefined;
      return String(url).endsWith('/api/workdirs') && reqInit?.method === 'POST';
    });
    expect(createWorkdirCalls).toHaveLength(0);

    const sessionCall = fetchSpy.mock.calls.find(([url]) =>
      String(url).includes('/api/terminal/sessions'),
    );
    expect(sessionCall).toBeDefined();
    const sessionInit = sessionCall?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(sessionInit?.body))).toMatchObject({ workdirId: 3 });
  });

  it('passes the typed command through to session-create', async () => {
    vi.restoreAllMocks();
    const fetchSpy = mockFetch([
      {
        id: 3,
        name: 'saved',
        path: '/home/me/saved',
        runner: 'local',
        containerName: null,
        gitRemote: null,
        defaultBranch: null,
        config: {},
        archivedAt: null,
        createdAt: '2026-01-01',
      },
    ]);
    const onCreated = vi.fn();
    render(
      <Wrap>
        <NewSessionDialog open onOpenChange={() => {}} onCreated={onCreated} />
      </Wrap>,
    );

    await screen.findByRole('button', { name: /start session/i });
    await userEvent.click(await screen.findByText('Select a workdir…'));
    await userEvent.click(await screen.findByRole('option', { name: /saved/i }));

    await userEvent.type(screen.getByPlaceholderText('claude'), 'pnpm test');
    await userEvent.click(screen.getByRole('button', { name: /start session/i }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(42));

    const sessionCall = fetchSpy.mock.calls.find(([url]) =>
      String(url).includes('/api/terminal/sessions'),
    );
    expect(sessionCall).toBeDefined();
    const sessionInit = sessionCall?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(sessionInit?.body))).toMatchObject({
      workdirId: 3,
      command: 'pnpm test',
    });
  });

  it('treats a typed name equal to the last seeded basename as a manual edit', async () => {
    render(
      <Wrap>
        <NewSessionDialog open onOpenChange={() => {}} onCreated={() => {}} />
      </Wrap>,
    );

    // Pick folder A ("~" → /home/me) — name seeds to its basename "me".
    await userEvent.click(await screen.findByRole('treeitem', { name: /~/ }));
    const nameInput = screen.getByPlaceholderText('tickets');
    expect(nameInput).toHaveValue('me');

    // Clear the name (re-arms seeding), then type the SAME basename back in —
    // this must still be treated as a manual edit, not silently ignored.
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'me');
    expect(nameInput).toHaveValue('me');

    // Picking a different folder (B) must NOT overwrite the name, even though
    // what's currently in the box happens to equal A's old seeded basename.
    const pathInput = screen.getByPlaceholderText(/absolute path/i);
    await userEvent.clear(pathInput);
    await userEvent.type(pathInput, '/srv/app');
    expect(nameInput).toHaveValue('me');
  });

  it('keeps a user edit after re-picking a same-basename folder (seed-echo does not stick)', async () => {
    render(
      <Wrap>
        <NewSessionDialog open onOpenChange={() => {}} onCreated={() => {}} />
      </Wrap>,
    );

    // Drive the seed via the fallback path input. We set full paths ATOMICALLY
    // with fireEvent.change (as a tree pick does), not char-by-char typing —
    // typing would pass through different intermediate basenames ("wor", …),
    // each re-firing the name-effect and clearing the stuck seed flag, which is
    // the exact state this bug depends on.
    const pathInput = await screen.findByPlaceholderText(/absolute path/i);
    const nameInput = screen.getByPlaceholderText('tickets');

    // Pick /repo1/work → name seeds "work".
    fireEvent.change(pathInput, { target: { value: '/repo1/work' } });
    await waitFor(() => expect(nameInput).toHaveValue('work'));

    // Pick /repo2/work — SAME basename "work". The reseed writes the string
    // already in the box: no primitive name change, so the seed flag stays set
    // (nothing consumes it). This is the trap the old flag-only check fell into.
    fireEvent.change(pathInput, { target: { value: '/repo2/work' } });
    await waitFor(() => expect(pathInput).toHaveValue('/repo2/work'));
    expect(nameInput).toHaveValue('work');

    // A genuine user edit to a DIFFERENT string must register as an edit even
    // with the flag stuck, because "custom" !== the last-seeded "work".
    fireEvent.change(nameInput, { target: { value: 'custom' } });
    await waitFor(() => expect(nameInput).toHaveValue('custom'));

    // Picking a different-basename folder must NOT clobber the user's edit.
    fireEvent.change(pathInput, { target: { value: '/repo3/other' } });
    await waitFor(() => expect(pathInput).toHaveValue('/repo3/other'));
    expect(nameInput).toHaveValue('custom');
  });

  it('clear then retype the basename holds against a later folder pick', async () => {
    render(
      <Wrap>
        <NewSessionDialog open onOpenChange={() => {}} onCreated={() => {}} />
      </Wrap>,
    );

    const pathInput = await screen.findByPlaceholderText(/absolute path/i);
    const nameInput = screen.getByPlaceholderText('tickets');

    // Pick /repo1/work → name seeds "work".
    fireEvent.change(pathInput, { target: { value: '/repo1/work' } });
    await waitFor(() => expect(nameInput).toHaveValue('work'));

    // Clear (re-arms seeding) then manually retype the SAME basename "work".
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'work');
    expect(nameInput).toHaveValue('work');

    // A later folder pick must NOT overwrite it — the retype was a manual edit,
    // even though the value equals /repo1's old seeded basename.
    fireEvent.change(pathInput, { target: { value: '/repo2/other' } });
    await waitFor(() => expect(pathInput).toHaveValue('/repo2/other'));
    expect(nameInput).toHaveValue('work');
  });
});
