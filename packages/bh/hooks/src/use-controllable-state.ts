import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// A value the caller may hold, as "Writing a hook" lays out: the caller holds
// it while it passes `value`, decided on every render; the hook holds it from
// `defaultValue` otherwise. Private to the package for now: useDisclosure
// holds `open` with it, and TK-31.13 is where it would be exported, with
// @bh/ui's Dropdown moved onto it.

/** What `useControllableState` takes. */
export interface UseControllableStateOptions<T> {
  /** The value, for a caller that holds it; it then changes only through `onChange`. */
  value: T | undefined;
  /** Where it starts while the hook holds it. Read on the first render only. */
  defaultValue: T;
  /** Hears every change, with the new value, whoever holds it. */
  onChange: ((value: T) => void) | undefined;
}

/** Sets the value, or a function of the one now. The value itself is never a function. */
export type SetControllable<T> = (next: T | ((now: T) => T)) => void;

/**
 * The value, the caller's while it passes one and the hook's otherwise, and
 * a setter that keeps one identity for the hook's life. Held by the caller,
 * the hook keeps no copy: the setter calls `onChange`, and the new value
 * comes back as a prop, so a caller that declines a change keeps what it
 * had. `onChange` is called once per change, outside any render or state
 * update, and not for a value that is the one already there.
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: UseControllableStateOptions<T>): [T, SetControllable<T>] {
  const [held, setHeld] = useState(defaultValue);
  const owned = value !== undefined;
  const current = owned ? value : held;

  // What the setter reads when it runs, written after each commit: the
  // caller's latest onChange is the one called, memoised or not.
  const live = useRef({ value: current, owned, onChange });
  useLayoutEffect(() => {
    live.current = { value: current, owned, onChange };
  });

  const setValue = useCallback<SetControllable<T>>((next) => {
    const now = live.current;
    const resolved = typeof next === 'function' ? (next as (now: T) => T)(now.value) : next;
    if (Object.is(resolved, now.value)) {
      return;
    }
    // Held here, two changes in one event both count; held by the caller,
    // the value is the one it passes back.
    if (!now.owned) {
      now.value = resolved;
      setHeld(() => resolved);
    }
    now.onChange?.(resolved);
  }, []);

  return [current, setValue];
}
