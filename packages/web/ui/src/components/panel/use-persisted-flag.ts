import { useState } from 'react';

// An unset key must not read as false: "never chosen" and "chosen false" are
// different answers, and only the first should defer to the caller's fallback.
function readFlag(key: string | undefined): boolean | undefined {
  if (!key) return undefined;
  const raw = localStorage.getItem(key);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

export function usePersistedFlag(key: string | undefined, fallback: boolean) {
  const [value, setValue] = useState(() => readFlag(key) ?? fallback);
  const set = (next: boolean) => {
    setValue(next);
    if (key) localStorage.setItem(key, String(next));
  };
  return [value, set] as const;
}
