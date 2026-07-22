import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DirectoryTree } from './directory-tree';

const ROOTS = [{ path: '/home/me', symbol: '~', annotation: 'home · /home/me' }];

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ path: '/home/me', parent: '/home', entries: [{ name: 'work', path: '/home/me/work' }] }), { status: 200 }),
  );
});
afterEach(() => vi.restoreAllMocks());

describe('DirectoryTree', () => {
  it('renders root rows and reveals children on expand', async () => {
    render(<Wrap><DirectoryTree roots={ROOTS} selected={null} onSelect={() => {}} /></Wrap>);
    // caret toggle for the root
    await userEvent.click(screen.getByRole('button', { name: /expand \/home\/me/i }));
    await waitFor(() => expect(screen.getByText('work')).toBeInTheDocument());
  });

  it('clicking a folder name selects it', async () => {
    const onSelect = vi.fn();
    render(<Wrap><DirectoryTree roots={ROOTS} selected={null} onSelect={onSelect} /></Wrap>);
    await userEvent.click(screen.getByRole('treeitem', { name: /~/ }));
    expect(onSelect).toHaveBeenCalledWith('/home/me');
  });

  it('is a single tab stop (roving tabindex)', async () => {
    render(<Wrap><DirectoryTree roots={ROOTS} selected={null} onSelect={() => {}} /></Wrap>);
    await userEvent.tab();
    expect(screen.getByRole('tree')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('tree')).not.toHaveFocus(); // tab leaves the tree, not into row buttons
  });
});
