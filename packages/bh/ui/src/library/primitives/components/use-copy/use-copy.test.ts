import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText, useCopy } from './use-copy';

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

describe('copyText', () => {
  it('writes the text and resolves true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    await expect(copyText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('resolves false, without throwing, when the write rejects', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    await expect(copyText('hello')).resolves.toBe(false);
  });

  it('resolves false when the browser has no clipboard', async () => {
    stubClipboard(undefined);
    await expect(copyText('hello')).resolves.toBe(false);
  });
});

describe('useCopy', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('copies to the clipboard and reports copied, then resets to idle after 1500ms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const { result } = renderHook(() => useCopy());

    expect(result.current.copied).toBe(false);
    let written: boolean | undefined;
    await act(async () => {
      written = await result.current.copy('hello');
    });

    expect(written).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(result.current.copied).toBe(true);
    expect(result.current.failed).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.copied).toBe(false);
  });

  it('reports failed when the clipboard write rejects, then resets to idle after 1500ms', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const { result } = renderHook(() => useCopy());

    let written: boolean | undefined;
    await act(async () => {
      written = await result.current.copy('hello');
    });

    expect(written).toBe(false);
    expect(result.current.failed).toBe(true);
    expect(result.current.copied).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.failed).toBe(false);
  });

  it('reports failed when the browser has no clipboard', async () => {
    stubClipboard(undefined);
    const { result } = renderHook(() => useCopy());

    await act(async () => {
      await result.current.copy('hello');
    });

    expect(result.current.failed).toBe(true);
  });

  it('respects a custom resetMs', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const { result } = renderHook(() => useCopy(300));

    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
  });

  it('clears the pending reset timer on unmount so no update fires after unmount', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const setSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useCopy());

    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copied).toBe(true);

    // copy() itself unconditionally calls clearTimeout before scheduling the
    // reset timer, so a bare "was clearTimeout called at all" assertion would
    // pass even without the useEffect cleanup. Capture the id of the timer
    // that's actually pending post-copy, then clear the spy so anything
    // recorded from here on is attributable to unmount alone.
    const pendingTimerId = setSpy.mock.results.at(-1)?.value;
    expect(pendingTimerId).toBeDefined();
    clearSpy.mockClear();

    unmount();

    const clearedPendingTimer = clearSpy.mock.calls.filter(([id]) => id === pendingTimerId);
    expect(clearedPendingTimer).toHaveLength(1);

    setSpy.mockRestore();
    clearSpy.mockRestore();
  });
});
