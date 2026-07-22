import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DirectoryPicker } from './directory-picker';

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}
function Harness() {
  const [value, setValue] = useState('');
  return <DirectoryPicker value={value} onChange={setValue} />;
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('/api/workdirs/roots')) {
      return new Response(JSON.stringify([{ path: '/home/me', symbol: '~', annotation: 'home · /home/me' }]), { status: 200 });
    }
    return new Response(JSON.stringify({ path: '/home/me', parent: '/home', entries: [{ name: 'work', path: '/home/me/work' }] }), { status: 200 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe('DirectoryPicker', () => {
  it('typing an absolute path in the fallback input updates the value', async () => {
    render(<Wrap><Harness /></Wrap>);
    const input = screen.getByPlaceholderText(/absolute path/i);
    await userEvent.type(input, '/srv/app');
    expect(input).toHaveValue('/srv/app');
    expect(screen.getByText('/srv/app')).toBeInTheDocument(); // shows in the path bar
  });

  it('selecting a folder in the tree fills the path bar and input', async () => {
    render(<Wrap><Harness /></Wrap>);
    await userEvent.click(await screen.findByRole('treeitem', { name: /~/ }));
    expect(screen.getByPlaceholderText(/absolute path/i)).toHaveValue('/home/me');
  });
});
