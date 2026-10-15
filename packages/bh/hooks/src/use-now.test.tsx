import { act, render, renderHook, screen } from '@testing-library/react';
import { StrictMode, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './use-now';

// 10:00:00.250 on a day in 2026: a quarter of a second into a second.
const START = Date.UTC(2026, 9, 15, 10, 0, 0, 250);

/** Moves the clock on by `ms`, and renders what that changed. */
function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

// The plain view it drives, as on its page: how long ago something was saved.
function SavedAgo({ at }: { at: number }) {
  const now = useNow();
  return <p>Saved {Math.floor((now - at) / 1000)} seconds ago</p>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

describe('useNow', () => {
  it('starts at the time it renders at', () => {
    const { result } = renderHook(() => useNow());
    expect(result.current).toBe(START);
  });

  it('ticks on each whole second, not a second from the render', () => {
    const { result } = renderHook(() => useNow());
    wait(749);
    expect(result.current).toBe(START);
    wait(1);
    expect(result.current).toBe(START + 750);
    wait(1000);
    expect(result.current).toBe(START + 1750);
  });

  it('ticks on each whole interval it is given', () => {
    const { result } = renderHook(() => useNow({ interval: 60_000 }));
    wait(59_000);
    expect(result.current).toBe(START);
    wait(750);
    expect(result.current).toBe(START + 59_750);
  });

  it('keeps its time while not enabled, and says the time at once when it is again', () => {
    const { result, rerender } = renderHook((props) => useNow(props), {
      initialProps: { enabled: false },
    });
    wait(5000);
    expect(result.current).toBe(START);
    rerender({ enabled: true });
    expect(result.current).toBe(START + 5000);
  });

  it('never ticks at an interval that is no positive number', () => {
    const { result } = renderHook(() => useNow({ interval: 0 }));
    wait(5000);
    expect(result.current).toBe(START);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ticks every clock at one interval on the same timer, together', () => {
    const first = renderHook(() => useNow());
    wait(300);
    const second = renderHook(() => useNow());
    expect(vi.getTimerCount()).toBe(1);
    wait(450);
    expect(first.result.current).toBe(START + 750);
    expect(second.result.current).toBe(START + 750);
  });

  it('says the time at once when its tab comes back into view', () => {
    const { result } = renderHook(() => useNow({ interval: 60_000 }));
    setVisibility('hidden');
    act(() => {
      vi.setSystemTime(START + 30_000);
    });
    setVisibility('visible');
    expect(result.current).toBe(START + 30_000);
  });

  it('renders nothing new as it mounts within the tick it rendered in', () => {
    let commits = 0;
    function Counted() {
      useNow();
      useEffect(() => {
        commits += 1;
      });
      return null;
    }
    render(<Counted />);
    expect(commits).toBe(1);
  });

  it('drives a plain view', () => {
    render(<SavedAgo at={START - 2000} />);
    expect(screen.getByText('Saved 2 seconds ago')).toBeInTheDocument();
    wait(750);
    expect(screen.getByText('Saved 2 seconds ago')).toBeInTheDocument();
    wait(1000);
    expect(screen.getByText('Saved 3 seconds ago')).toBeInTheDocument();
  });

  it('leaves one timer under StrictMode, and none once unmounted', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useNow(), { wrapper: StrictMode });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
