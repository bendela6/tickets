/// <reference types="@testing-library/jest-dom/vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableWidths } from './use-table-widths';

describe('useTableWidths', () => {
  beforeEach(() => localStorage.clear());

  it('persists widths under the key it is given and rehydrates on next mount', () => {
    const a = renderHook(() => useTableWidths('app:sites'));
    act(() => a.result.current[1]('name', 240));
    expect(JSON.parse(localStorage.getItem('app:sites:widths') ?? '{}')).toEqual({
      name: 240,
    });
    a.unmount();

    const b = renderHook(() => useTableWidths('app:sites'));
    expect(b.result.current[0]).toEqual({ name: 240 });
  });

  it('adds no prefix of its own', () => {
    const { result } = renderHook(() => useTableWidths('app:sites'));
    act(() => result.current[1]('name', 240));
    expect(Object.keys(localStorage)).toEqual(['app:sites:widths']);
  });

  it('handles a corrupted localStorage entry gracefully', () => {
    localStorage.setItem('app:other:widths', 'not-json');
    const { result } = renderHook(() => useTableWidths('app:other'));
    expect(result.current[0]).toEqual({});
  });

  // Storage throws outright when site data is blocked (a browser setting, a
  // policy, a sandboxed frame) and again on a full quota. Remembering widths is
  // a convenience: the table must still draw, and a drag must still resize.
  describe('when storage refuses', () => {
    afterEach(() => vi.restoreAllMocks());

    it('starts with no widths when reading throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      const { result } = renderHook(() => useTableWidths('app:sites'));
      expect(result.current[0]).toEqual({});
    });

    it('still records a width when writing throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      const { result } = renderHook(() => useTableWidths('app:sites'));
      act(() => result.current[1]('name', 240));
      expect(result.current[0]).toEqual({ name: 240 });
    });
  });
});
