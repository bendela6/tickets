import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readStored, usePersistedState, writeStored } from './use-persisted-state';

const KEY = 'test:width';

/** A storage event from another tab of the app, as the browser sends it. */
function fromAnotherTab(key: string | null, value: string | null) {
  if (key !== null) {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  }
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', { key, newValue: value, storageArea: localStorage }),
    );
  });
}

/** Every call `localStorage` takes throws, as where site data is blocked. */
function blockStorage() {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
}

// The plain view it drives, as on its page: a button and what it counts.
function Counter({ name }: { name: string }) {
  const [count, setCount] = usePersistedState({ key: 'test:count', defaultValue: 0 });
  return (
    <button type="button" onClick={() => setCount((before) => before + 1)}>
      {`${name}: ${String(count)}`}
    </button>
  );
}

// Each test takes a key of its own, so no test reads what another stored.
let unique = 0;
const freshKey = () => `test:${String((unique += 1))}`;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readStored and writeStored', () => {
  it('read and write localStorage under the key', () => {
    writeStored(KEY, '240');
    expect(localStorage.getItem(KEY)).toBe('240');
    expect(readStored(KEY)).toBe('240');
  });

  it('take a key out for null', () => {
    writeStored(KEY, '240');
    writeStored(KEY, null);
    expect(readStored(KEY)).toBeNull();
  });

  it('read and write nothing without a key', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    writeStored(undefined, '240');
    expect(setItem).not.toHaveBeenCalled();
    expect(readStored(undefined)).toBeNull();
    expect(readStored('')).toBeNull();
  });

  it('read a storage that throws as empty, and write to it without throwing', () => {
    blockStorage();
    expect(readStored(KEY)).toBeNull();
    expect(() => writeStored(KEY, '240')).not.toThrow();
    expect(() => writeStored(KEY, null)).not.toThrow();
  });
});

describe('usePersistedState', () => {
  describe('held by the hook', () => {
    it('starts at defaultValue while nothing is stored', () => {
      const key = freshKey();
      const { result } = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      expect(result.current[0]).toBe(240);
    });

    it('starts at what is stored', () => {
      const key = freshKey();
      localStorage.setItem(key, '320');
      const { result } = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      expect(result.current[0]).toBe(320);
    });

    it('stores what it is set to, as JSON', () => {
      const key = freshKey();
      const { result } = renderHook(() => {
        return usePersistedState({ key, defaultValue: { open: false } });
      });
      act(() => result.current[1]({ open: true }));
      expect(result.current[0]).toEqual({ open: true });
      expect(localStorage.getItem(key)).toBe('{"open":true}');
    });

    it('takes a function of the value before, and two in a row both count', () => {
      const key = freshKey();
      const { result } = renderHook(() => usePersistedState({ key, defaultValue: 0 }));
      act(() => {
        result.current[1]((before) => before + 1);
        result.current[1]((before) => before + 1);
      });
      expect(result.current[0]).toBe(2);
      expect(localStorage.getItem(key)).toBe('2');
    });

    it('stores with serialize and reads with parse', () => {
      const key = freshKey();
      localStorage.setItem(key, 'yes');
      const parse = (raw: string) => (raw === 'yes' ? true : raw === 'no' ? false : undefined);
      const serialize = (value: boolean) => (value ? 'yes' : 'no');
      const { result } = renderHook(() => {
        return usePersistedState({ key, defaultValue: false, parse, serialize });
      });
      expect(result.current[0]).toBe(true);
      act(() => result.current[1](false));
      expect(localStorage.getItem(key)).toBe('no');
    });

    it('reads a string that will not parse, or that parse turns down, as unset', () => {
      const broken = freshKey();
      localStorage.setItem(broken, '{not json');
      const { result } = renderHook(() => usePersistedState({ key: broken, defaultValue: 240 }));
      expect(result.current[0]).toBe(240);

      const declined = freshKey();
      localStorage.setItem(declined, '"wide"');
      const parse = (raw: string) => {
        const value: unknown = JSON.parse(raw);
        return typeof value === 'number' ? value : undefined;
      };
      const second = renderHook(() => {
        return usePersistedState({ key: declined, defaultValue: 240, parse });
      });
      expect(second.result.current[0]).toBe(240);
    });
  });

  describe('without a key', () => {
    it('is plain state, and stores nothing', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const { result } = renderHook(() => usePersistedState({ key: undefined, defaultValue: 240 }));
      act(() => result.current[1](320));
      expect(result.current[0]).toBe(320);
      act(() => result.current[1]((before) => before + 1));
      expect(result.current[0]).toBe(321);
      expect(setItem).not.toHaveBeenCalled();
    });

    it('keeps a function as the value, rather than calling it', () => {
      const first = () => 'first';
      const second = () => 'second';
      const { result } = renderHook(() => {
        return usePersistedState<() => string>({ key: undefined, defaultValue: first });
      });
      act(() => result.current[1](() => second));
      expect(result.current[0]).toBe(second);
    });
  });

  describe('in sessionStorage', () => {
    it('reads and writes the tab’s own storage, apart from localStorage', () => {
      const key = freshKey();
      sessionStorage.setItem(key, '320');
      const { result } = renderHook(() => {
        return usePersistedState({ key, defaultValue: 240, storage: 'session' });
      });
      expect(result.current[0]).toBe(320);
      act(() => result.current[1](400));
      expect(sessionStorage.getItem(key)).toBe('400');
      expect(localStorage.getItem(key)).toBeNull();
      expect(readStored(key, 'session')).toBe('400');
      writeStored(key, null, 'session');
      expect(sessionStorage.getItem(key)).toBeNull();
    });
  });

  describe('a storage that refuses', () => {
    it('reads as empty, and the value still changes for the page', () => {
      blockStorage();
      const key = freshKey();
      const { result } = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      expect(result.current[0]).toBe(240);
      act(() => result.current[1](320));
      expect(result.current[0]).toBe(320);
    });

    it('keeps what it refused while the key is in use, and forgets it after', () => {
      blockStorage();
      const key = freshKey();
      const first = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      const second = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      act(() => first.result.current[1](320));
      expect(second.result.current[0]).toBe(320);
      first.unmount();
      second.unmount();
      const later = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      expect(later.result.current[0]).toBe(240);
    });

    it('stores again once the storage takes it', () => {
      const key = freshKey();
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      const { result } = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      act(() => result.current[1](320));
      expect(result.current[0]).toBe(320);
      expect(localStorage.getItem(key)).toBeNull();
      setItem.mockRestore();
      act(() => result.current[1](400));
      expect(localStorage.getItem(key)).toBe('400');
      expect(result.current[0]).toBe(400);
    });
  });

  describe('one key, one value', () => {
    it('keeps two places on the page in step', () => {
      render(
        <>
          <Counter name="Left" />
          <Counter name="Right" />
        </>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Left: 0' }));
      expect(screen.getByRole('button', { name: 'Left: 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Right: 1' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Right: 1' }));
      expect(screen.getByRole('button', { name: 'Left: 2' })).toBeInTheDocument();
    });

    it('follows writeStored on the page, a null going back to defaultValue', () => {
      const key = freshKey();
      const { result } = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      act(() => writeStored(key, '320'));
      expect(result.current[0]).toBe(320);
      act(() => writeStored(key, null));
      expect(result.current[0]).toBe(240);
    });

    it('follows another tab of the app', () => {
      const key = freshKey();
      const { result } = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      act(() => result.current[1](300));
      fromAnotherTab(key, '400');
      expect(result.current[0]).toBe(400);
      fromAnotherTab(key, null);
      expect(result.current[0]).toBe(240);
    });

    it('goes back to defaultValue when another tab clears the storage', () => {
      const key = freshKey();
      localStorage.setItem(key, '320');
      const { result } = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      localStorage.clear();
      fromAnotherTab(null, null);
      expect(result.current[0]).toBe(240);
    });

    it('lets another key, or sessionStorage, be', () => {
      const key = freshKey();
      const { result } = renderHook(() => usePersistedState({ key, defaultValue: 240 }));
      act(() => result.current[1](300));
      fromAnotherTab('test:other', '1');
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', { key, newValue: '9', storageArea: sessionStorage }),
        );
      });
      expect(result.current[0]).toBe(300);
    });

    it('follows a new key', () => {
      const first = freshKey();
      const second = freshKey();
      localStorage.setItem(second, '500');
      const { result, rerender } = renderHook(
        ({ key }) => usePersistedState({ key, defaultValue: 240 }),
        { initialProps: { key: first } },
      );
      rerender({ key: second });
      expect(result.current[0]).toBe(500);
      act(() => result.current[1](600));
      expect(localStorage.getItem(second)).toBe('600');
      expect(localStorage.getItem(first)).toBeNull();
    });
  });

  it('keeps its setter for its life', () => {
    const key = freshKey();
    const { result, rerender } = renderHook(() => usePersistedState({ key, defaultValue: 0 }));
    const [, setValue] = result.current;
    act(() => setValue(1));
    rerender();
    expect(result.current[1]).toBe(setValue);
  });

  it('keeps a stored object while nothing changes it', () => {
    const key = freshKey();
    localStorage.setItem(key, '{"a":1}');
    const { result, rerender } = renderHook(() => usePersistedState({ key, defaultValue: {} }));
    const first = result.current[0];
    rerender();
    expect(result.current[0]).toBe(first);
  });

  it('stores once under StrictMode', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const key = freshKey();
    const { result } = renderHook(() => usePersistedState({ key, defaultValue: 0 }), {
      wrapper: StrictMode,
    });
    act(() => result.current[1]((before) => before + 1));
    expect(result.current[0]).toBe(1);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('stops listening for other tabs once unmounted', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const key = freshKey();
    const { unmount } = renderHook(() => usePersistedState({ key, defaultValue: 0 }));
    const added = add.mock.calls.filter(([type]) => type === 'storage').map(([, fn]) => fn);
    expect(added).toHaveLength(1);
    unmount();
    const removed = remove.mock.calls.filter(([type]) => type === 'storage').map(([, fn]) => fn);
    expect(removed).toEqual(added);
  });
});
