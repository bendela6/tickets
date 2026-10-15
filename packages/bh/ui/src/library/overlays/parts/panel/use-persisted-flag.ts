import { usePersistedState } from '@bh/hooks';

// An unset key must not read as false: "never chosen" and "chosen false" are
// different answers, and only the first should defer to the caller's fallback.
// Anything else stored, or storage that can't be read, counts as never chosen.
function parseFlag(raw: string): boolean | undefined {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return undefined;
}

/**
 * A flag kept under the app's key, as `usePersistedState` keeps it: every
 * place using the key, on the page and in the app's other tabs, holds the
 * one value. Without a key it lives as long as the component.
 */
export function usePersistedFlag(key: string | undefined, fallback: boolean) {
  const [value, setValue] = usePersistedState({ key, defaultValue: fallback, parse: parseFlag });
  return [value, setValue] as const;
}
