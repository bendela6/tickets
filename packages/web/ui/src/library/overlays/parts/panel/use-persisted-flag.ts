import { useState } from 'react';
import { readStored, writeStored } from './safe-storage';

// An unset key must not read as false: "never chosen" and "chosen false" are
// different answers, and only the first should defer to the caller's fallback.
// Unreadable storage counts as "never chosen" — see safe-storage.
function readFlag(key: string | undefined): boolean | undefined {
  const raw = readStored(key);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

export function usePersistedFlag(key: string | undefined, fallback: boolean) {
  const [value, setValue] = useState(() => readFlag(key) ?? fallback);
  const set = (next: boolean) => {
    setValue(next);
    writeStored(key, String(next));
  };
  return [value, set] as const;
}
