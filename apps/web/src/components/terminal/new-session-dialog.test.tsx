import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
});
