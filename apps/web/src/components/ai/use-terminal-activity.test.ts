import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminalActivity } from './use-terminal-activity';

describe('useTerminalActivity', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is busy right after a ping and clears after the idle window', () => {
    const { result } = renderHook(() => useTerminalActivity(800));
    expect(result.current.busy).toBe(false);
    act(() => result.current.ping());
    expect(result.current.busy).toBe(true);
    act(() => vi.advanceTimersByTime(801));
    expect(result.current.busy).toBe(false);
  });
});
