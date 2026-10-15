import { act, render, renderHook, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './use-media-query';

// jsdom has no matchMedia: this one answers from `matching`, and tells the
// listeners of each query when `change` moves it.
const matching = new Set<string>();
const listeners = new Map<string, Set<() => void>>();

function change(query: string, matches: boolean) {
  if (matches) {
    matching.add(query);
  } else {
    matching.delete(query);
  }
  act(() => {
    listeners.get(query)?.forEach((listener) => listener());
  });
}

beforeEach(() => {
  matching.clear();
  listeners.clear();
  vi.stubGlobal('matchMedia', (query: string) => {
    return {
      get matches() {
        return matching.has(query);
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => {
        const own = listeners.get(query) ?? new Set();
        own.add(listener);
        listeners.set(query, own);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.get(query)?.delete(listener);
      },
    };
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const NARROW = '(max-width: 767px)';

// The plain view it drives, as on its page.
function Layout() {
  const narrow = useMediaQuery(NARROW);
  return <p>{narrow ? 'One column' : 'Two columns'}</p>;
}

describe('useMediaQuery', () => {
  it('says whether the query matches on its first render', () => {
    matching.add(NARROW);
    const { result } = renderHook(() => useMediaQuery(NARROW));
    expect(result.current).toBe(true);
  });

  it('follows the query as it changes', () => {
    render(<Layout />);
    expect(screen.getByText('Two columns')).toBeInTheDocument();
    change(NARROW, true);
    expect(screen.getByText('One column')).toBeInTheDocument();
    change(NARROW, false);
    expect(screen.getByText('Two columns')).toBeInTheDocument();
  });

  it('follows a new query', () => {
    matching.add('(hover: hover)');
    const { result, rerender } = renderHook(({ query }) => useMediaQuery(query), {
      initialProps: { query: NARROW },
    });
    expect(result.current).toBe(false);
    rerender({ query: '(hover: hover)' });
    expect(result.current).toBe(true);
    expect(listeners.get(NARROW)?.size ?? 0).toBe(0);
  });

  it('matches nothing for no query', () => {
    const { result } = renderHook(() => useMediaQuery(undefined, { serverValue: true }));
    expect(result.current).toBe(false);
  });

  it('gives its server value where there is no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useMediaQuery(NARROW)).result.current).toBe(false);
    expect(renderHook(() => useMediaQuery(NARROW, { serverValue: true })).result.current).toBe(
      true,
    );
  });

  it('leaves one listener under StrictMode, and none once unmounted', () => {
    const { unmount } = render(
      <StrictMode>
        <Layout />
      </StrictMode>,
    );
    expect(listeners.get(NARROW)?.size).toBe(1);
    unmount();
    expect(listeners.get(NARROW)?.size).toBe(0);
  });
});
