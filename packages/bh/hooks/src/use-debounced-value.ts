import { useEffect, useState } from 'react';

/** What `useDebouncedValue` takes after the value. */
export interface UseDebouncedValueOptions {
  /** How long the value must stay the same, in milliseconds, before it is handed on. */
  delay: number;
}

/**
 * A value that follows `value` once it has stopped changing for `delay`
 * milliseconds: a search box's text, sent once the typing stops. It starts
 * at `value`, which is its server value too.
 *
 * Each change starts the wait again, so pass a value that is the same while
 * it means the same: a string or a number, or an object kept outside the
 * render.
 *
 * @param value What to follow.
 * @returns `value` as it was when it last stood still for `delay`.
 */
export function useDebouncedValue<T>(value: T, { delay }: UseDebouncedValueOptions): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      // As a function, so a value that is itself one is kept, not called.
      setSettled(() => value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
