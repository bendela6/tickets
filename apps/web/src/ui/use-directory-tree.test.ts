import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent } from 'react';

import { useDirectoryTree } from './use-directory-tree';

const ROOTS = [{ path: '/home/me', symbol: '~', annotation: 'home' }];

// Synthetic keyboard event — onKeyDown only reads `.key` and calls `.preventDefault()`.
function key(k: string): KeyboardEvent {
  return { key: k, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function strictWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(StrictMode, null, createElement(QueryClientProvider, { client: qc }, children));
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

describe('useDirectoryTree keyboard navigation', () => {
  it('ArrowDown then ArrowUp move focus between visible rows', async () => {
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }), { wrapper: wrapper() });
    act(() => result.current.toggle('/home/me'));
    await waitFor(() => expect(result.current.rows.map((r) => r.path)).toContain('/home/me/work'));

    expect(result.current.focus).toBe('/home/me');
    act(() => result.current.onKeyDown(key('ArrowDown')));
    expect(result.current.focus).toBe('/home/me/work');
    act(() => result.current.onKeyDown(key('ArrowUp')));
    expect(result.current.focus).toBe('/home/me');
  });

  it('ArrowRight on a collapsed root expands it', async () => {
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }), { wrapper: wrapper() });
    expect(result.current.rows.map((r) => r.path)).toEqual(['/home/me']);

    act(() => result.current.onKeyDown(key('ArrowRight')));
    await waitFor(() => expect(result.current.rows.map((r) => r.path)).toContain('/home/me/work'));
    expect(result.current.rows.find((r) => r.path === '/home/me')?.expanded).toBe(true);
  });

  it('ArrowLeft on an expanded node collapses it', async () => {
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }), { wrapper: wrapper() });
    act(() => result.current.toggle('/home/me'));
    await waitFor(() => expect(result.current.rows.map((r) => r.path)).toContain('/home/me/work'));

    act(() => result.current.onKeyDown(key('ArrowLeft')));
    expect(result.current.rows.map((r) => r.path)).toEqual(['/home/me']);
  });

  it('ArrowLeft from the last of 3 children moves focus to the parent root, not a sibling', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      const body = {
        path: '/home/me',
        parent: '/home',
        entries: [
          { name: 'a', path: '/home/me/a' },
          { name: 'b', path: '/home/me/b' },
          { name: 'c', path: '/home/me/c' },
        ],
      };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }), { wrapper: wrapper() });
    act(() => result.current.toggle('/home/me'));
    await waitFor(() => expect(result.current.rows.map((r) => r.path)).toContain('/home/me/c'));
    expect(result.current.rows.map((r) => r.path)).toEqual(['/home/me', '/home/me/a', '/home/me/b', '/home/me/c']);

    act(() => result.current.setFocus('/home/me/c'));
    expect(result.current.focus).toBe('/home/me/c');

    act(() => result.current.onKeyDown(key('ArrowLeft')));
    expect(result.current.focus).toBe('/home/me');
  });

  it('Enter calls onSelect with the focused path', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect }), { wrapper: wrapper() });
    expect(result.current.focus).toBe('/home/me');

    act(() => result.current.onKeyDown(key('Enter')));
    expect(onSelect).toHaveBeenCalledWith('/home/me');
  });

  it('calls preventDefault for a handled key', () => {
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }), { wrapper: wrapper() });
    const e = key('ArrowDown');
    act(() => result.current.onKeyDown(e));
    expect(e.preventDefault).toHaveBeenCalled();
  });

  // Guards Fix 1 (updater purity): under StrictMode, React double-invokes state
  // updater functions. If `load(path)` were called from inside a nested updater
  // body, this would fetch the path twice. `toggle` now decides via refs and
  // calls `load` exactly once, outside any updater, so a single expand — even
  // double-invoked by StrictMode — issues exactly one fetch.
  it('StrictMode: a single expand fetches the path exactly once', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }), { wrapper: strictWrapper() });
    fetchMock.mockClear();
    act(() => result.current.toggle('/home/me'));
    await waitFor(() => expect(result.current.rows.map((r) => r.path)).toContain('/home/me/work'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
