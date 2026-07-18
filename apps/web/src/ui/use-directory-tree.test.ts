import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDirectoryTree } from './use-directory-tree';

const ROOTS = [{ path: '/home/me', symbol: '~', annotation: 'home' }];

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    const body = u.includes('%2Fhome%2Fme')
      ? { path: '/home/me', parent: '/home', entries: [{ name: 'work', path: '/home/me/work' }] }
      : { path: '/x', parent: '/', entries: [] };
    return new Response(JSON.stringify(body), { status: 200 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe('useDirectoryTree', () => {
  it('starts with only root rows visible', () => {
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }), { wrapper: wrapper() });
    expect(result.current.rows.map((r) => r.path)).toEqual(['/home/me']);
    expect(result.current.rows[0]?.isRoot).toBe(true);
  });

  it('expanding a node loads and reveals its children', async () => {
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }), { wrapper: wrapper() });
    act(() => result.current.toggle('/home/me'));
    await waitFor(() => expect(result.current.rows.map((r) => r.path)).toContain('/home/me/work'));
    expect(result.current.rows.find((r) => r.path === '/home/me')?.expanded).toBe(true);
  });

  it('select calls onSelect with the path', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect }), { wrapper: wrapper() });
    act(() => result.current.select('/home/me'));
    expect(onSelect).toHaveBeenCalledWith('/home/me');
  });
});
