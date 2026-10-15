import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

/** Which of the browser's storages a value is kept in: `localStorage`, or the tab's own `sessionStorage`. */
export type StoredIn = 'local' | 'session';

/** What `usePersistedState` takes. */
export interface UsePersistedStateOptions<T> {
  /** The app's name for it, as `shop:sidebar`; without one nothing is stored, and it lives as long as the component. */
  key: string | undefined;
  /** The value while nothing is stored, and on a server. */
  defaultValue: T;
  /** The string stored for a value. `JSON.stringify` unless given. */
  serialize?: (value: T) => string;
  /** A stored string's value, or `undefined` for one it can't read, which reads as unset. `JSON.parse` unless given. */
  parse?: (raw: string) => T | undefined;
  /** `localStorage` unless `session`, which keeps it for the tab alone and only while the tab is open. */
  storage?: StoredIn;
}

/** `usePersistedState`'s setter: a value, or a function of the one before it, as `useState`'s takes. */
export type SetPersisted<T> = (next: T | ((previous: T) => T)) => void;

// Storage throws where site data is blocked (a browser setting, a policy, a
// sandboxed frame), even to be reached, and `setItem` again when it is full:
// each reads as nothing stored, and the value still changes for this page.

function storageOf(storage: StoredIn): Storage {
  return storage === 'session' ? sessionStorage : localStorage;
}

/**
 * The string stored under `key`, or `null` for none: no key, nothing stored,
 * or a storage that can't be read.
 *
 * @param key The app's name for it; `undefined` reads nothing.
 * @param storage `localStorage` unless `session`.
 */
export function readStored(key: string | undefined, storage: StoredIn = 'local'): string | null {
  if (!key) {
    return null;
  }
  try {
    return storageOf(storage).getItem(key);
  } catch {
    return null;
  }
}

// Who to tell when a key changes, so one key is one value on the page; and
// what this page wrote under a key that its storage refused (blocked, or
// full), which stands in for the stored value while anything on the page
// uses the key. Both are by the storage and the key, as `local:shop:sidebar`.
const listeners = new Map<string, Set<() => void>>();
const refused = new Map<string, string>();

const slotOf = (key: string, storage: StoredIn) => `${storage}:${key}`;

/**
 * Stores `raw` under `key`, or takes the key out for `null`, and every
 * `usePersistedState` on the page under the key follows. A storage that
 * refuses it, blocked or full, is let be: the value is not remembered, and
 * nothing throws.
 *
 * @param key The app's name for it; `undefined` stores nothing.
 * @param raw The string to keep, or `null` to forget it.
 * @param storage `localStorage` unless `session`.
 */
export function writeStored(
  key: string | undefined,
  raw: string | null,
  storage: StoredIn = 'local',
): void {
  if (!key) {
    return;
  }
  try {
    if (raw === null) {
      storageOf(storage).removeItem(key);
    } else {
      storageOf(storage).setItem(key, raw);
    }
  } catch {
    // Not remembered, but still changed for the page: see readStored.
  }
  const slot = slotOf(key, storage);
  const own = listeners.get(slot);
  if (!own) {
    return;
  }
  // Read back, since a storage that refuses says nothing.
  if (raw === null || readStored(key, storage) === raw) {
    refused.delete(slot);
  } else {
    refused.set(slot, raw);
  }
  own.forEach((listener) => listener());
}

function snapshot(key: string, storage: StoredIn): string | null {
  const slot = slotOf(key, storage);
  return refused.has(slot) ? (refused.get(slot) ?? null) : readStored(key, storage);
}

/** Whether a `storage` event is about `storage`: a cleared one has no area to compare. */
function isFrom(area: Storage | null, storage: StoredIn): boolean {
  try {
    return area === null || area === storageOf(storage);
  } catch {
    return false;
  }
}

function subscribe(key: string, storage: StoredIn, listener: () => void): () => void {
  const slot = slotOf(key, storage);
  const own = listeners.get(slot) ?? new Set<() => void>();
  own.add(listener);
  listeners.set(slot, own);
  // Another tab of the app wrote it, or cleared the storage (a `null` key).
  // A session storage is the tab's own, so only this page writes it.
  const onStorage = (event: StorageEvent) => {
    if ((event.key === key || event.key === null) && isFrom(event.storageArea, storage)) {
      refused.delete(slot);
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    own.delete(listener);
    if (own.size === 0) {
      listeners.delete(slot);
      refused.delete(slot);
    }
    window.removeEventListener('storage', onStorage);
  };
}

/** A stored string's value, or `undefined` for none, or for one `parse` turns down or throws on. */
function parsed<T>(raw: string | null, parse: (raw: string) => T | undefined): T | undefined {
  if (raw === null) {
    return undefined;
  }
  try {
    return parse(raw);
  } catch {
    return undefined;
  }
}

const NOTHING_STORED = () => null;

/**
 * `useState` that remembers: a value kept in `localStorage` under the app's
 * key, read back on the next visit. Every component on the page using the
 * key holds the one value, and so do the app's other open tabs, through the
 * browser's `storage` event.
 *
 * Its server value is `defaultValue`: nothing is read until the browser
 * renders. Pass `parse` and an object `defaultValue` from outside the
 * component, so the value keeps its identity between renders.
 *
 * @returns The value, and its setter, which keeps one identity for the hook's life.
 */
export function usePersistedState<T>({
  key,
  defaultValue,
  serialize = JSON.stringify,
  parse = JSON.parse,
  storage = 'local',
}: UsePersistedStateOptions<T>): [T, SetPersisted<T>] {
  // Without a key, plain state.
  const [held, setHeld] = useState(defaultValue);
  const subscribeToKey = useCallback(
    (listener: () => void) => (key ? subscribe(key, storage, listener) : () => undefined),
    [key, storage],
  );
  const raw = useSyncExternalStore(
    subscribeToKey,
    () => (key ? snapshot(key, storage) : null),
    // The server value: nothing stored.
    NOTHING_STORED,
  );
  const stored = useMemo(() => parsed(raw, parse), [raw, parse]);
  const value = key ? (stored ?? defaultValue) : held;

  // What the setter reads when it runs: it keeps one identity for the hook's life.
  const live = useRef({ key, storage, value, defaultValue, serialize, parse });
  useLayoutEffect(() => {
    live.current = { key, storage, value, defaultValue, serialize, parse };
  });
  const setValue = useCallback<SetPersisted<T>>((next) => {
    const now = live.current;
    // A stored value is read where it is kept, so a write by another
    // component since this one last rendered is the one this follows.
    const previous = now.key
      ? (parsed(snapshot(now.key, now.storage), now.parse) ?? now.defaultValue)
      : now.value;
    const resolved = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
    now.value = resolved;
    if (now.key) {
      writeStored(now.key, now.serialize(resolved), now.storage);
    } else {
      // As a function, so a value that is itself one is kept, not called.
      setHeld(() => resolved);
    }
  }, []);

  return [value, setValue];
}
