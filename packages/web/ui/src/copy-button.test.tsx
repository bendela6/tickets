import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton, useCopy } from './copy-button';

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

describe('useCopy', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('copies to the clipboard and reports copied, then resets to idle after 1500ms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const { result } = renderHook(() => useCopy());

    expect(result.current.copied).toBe(false);
    await act(async () => {
      await result.current.copy('hello');
    });

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(result.current.copied).toBe(true);
    expect(result.current.failed).toBe(false);

    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.copied).toBe(false);
  });

  it('reports failed when the clipboard write rejects, then resets to idle after 1500ms', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const { result } = renderHook(() => useCopy());

    await act(async () => {
      await result.current.copy('hello');
    });

    expect(result.current.failed).toBe(true);
    expect(result.current.copied).toBe(false);

    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.failed).toBe(false);
  });

  it('respects a custom resetMs', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const { result } = renderHook(() => useCopy(300));

    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(299));
    expect(result.current.copied).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.copied).toBe(false);
  });

  it('clears the pending reset timer on unmount so no update fires after unmount', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useCopy());

    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copied).toBe(true);

    unmount();
    expect(clearSpy).toHaveBeenCalled();

    // Advancing timers past the reset window after unmount must not throw —
    // the pending setState was cancelled by the effect cleanup.
    expect(() => act(() => vi.advanceTimersByTime(1500))).not.toThrow();
    clearSpy.mockRestore();
  });
});

describe('CopyButton', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the label, then the copied label after a click, then back after resetMs', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="hello" />);

    const button = screen.getByRole('button', { name: 'Copy' });
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();

    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('supports custom label and copiedLabel text', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="hello" label="Copy DSN" copiedLabel="Copied!" />);

    const button = screen.getByRole('button', { name: 'Copy DSN' });
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Copied!' })).toBeTruthy();
  });

  it('shows a failed state when the clipboard write rejects', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    render(<CopyButton value="hello" />);

    const button = screen.getByRole('button', { name: 'Copy' });
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Failed' })).toBeTruthy();
  });

  it('merges an extra className onto the button', () => {
    render(<CopyButton value="hello" className="w-full" />);
    expect(screen.getByRole('button').className).toContain('w-full');
  });

  it('writes the given value to the clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<CopyButton value="the-dsn-string" />);

    await act(async () => {
      screen.getByRole('button').click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('the-dsn-string');
  });
});
