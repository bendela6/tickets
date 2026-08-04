import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent } from 'react';

import { useDirectoryTree } from './use-directory-tree';

// The API's REAL error shape (apps/api/src/workdir/workdir-fs.ts:89): an
// unreadable directory is HTTP 200 with `entries: []` AND an inline
// `error` string -- never a thrown/rejected fetch. EACCES, EPERM and ENOENT
// all collapse to this one shape. The transport-failure `catch` branch
// (a rejected fetch, or a non-JSON response) is a DIFFERENT, rarer path --
// covered by use-directory-tree.test.ts already -- and does not exercise
// the bug this file guards: an empty `entries: []` array is truthy, so a
// naive "do we already have entries" check treats an errored node as
// already loaded and never retries.

const ROOTS = [{ path: '/home/me', symbol: '~', annotation: 'home' }];

function key(k: string): KeyboardEvent {
  return { key: k, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

afterEach(() => vi.restoreAllMocks());

describe('useDirectoryTree — inline API error (HTTP 200, entries: [], error set)', () => {
  it('an errored row renders expanded:false and carries its message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ path: '/home/me', parent: '/home', entries: [], error: 'permission denied' }),
        { status: 200 },
      ),
    );
    const { result } = renderHook(
      () => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }),
      { wrapper: wrapper() },
    );

    act(() => result.current.toggle('/home/me'));
    await waitFor(() => expect(result.current.rows.find((r) => r.path === '/home/me')?.error).toBe('permission denied'));

    const row = result.current.rows.find((r) => r.path === '/home/me');
    expect(row?.expanded).toBe(false);
    expect(row?.error).toBe('permission denied');
  });

  it('collapse then re-expand re-fires the fetch (inline-error entries: [] must not look "already loaded")', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ path: '/home/me', parent: '/home', entries: [], error: 'permission denied' }),
        { status: 200 },
      ),
    );
    const { result } = renderHook(
      () => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }),
      { wrapper: wrapper() },
    );

    act(() => result.current.toggle('/home/me'));
    await waitFor(() => expect(result.current.rows.find((r) => r.path === '/home/me')?.error).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // "collapse" click -- row was already rendering closed, but the
    // underlying model still needs this to register as a real transition.
    act(() => result.current.toggle('/home/me'));
    // "expand" click again -- must retry, not silently no-op because
    // `entries: []` from the failed attempt reads as truthy.
    act(() => result.current.toggle('/home/me'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('ArrowLeft from an errored node reaches its parent', async () => {
    // '/home/me' loads normally and reveals 'locked'; expanding 'locked'
    // fails with the API's real inline-error shape.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes(encodeURIComponent('/home/me/locked'))) {
        return new Response(
          JSON.stringify({ path: '/home/me/locked', parent: '/home/me', entries: [], error: 'permission denied' }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ path: '/home/me', parent: '/home', entries: [{ name: 'locked', path: '/home/me/locked' }] }),
        { status: 200 },
      );
    });
    const { result } = renderHook(
      () => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }),
      { wrapper: wrapper() },
    );

    act(() => result.current.toggle('/home/me'));
    await waitFor(() => expect(result.current.rows.map((r) => r.path)).toContain('/home/me/locked'));

    act(() => result.current.setFocus('/home/me/locked'));
    act(() => result.current.onKeyDown(key('ArrowRight'))); // attempt to expand -- fails
    await waitFor(() => expect(result.current.rows.find((r) => r.path === '/home/me/locked')?.error).toBeTruthy());
    expect(result.current.rows.find((r) => r.path === '/home/me/locked')?.expanded).toBe(false);

    act(() => result.current.onKeyDown(key('ArrowLeft')));
    expect(result.current.focus).toBe('/home/me');
  });
});
