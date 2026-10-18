// Whether this browser has seen the running version: the last one its Version
// page was opened at, in localStorage. A browser's first visit counts as seen.

import { useCallback, useEffect, useState } from 'react';

const EVENT = 'bh-version-seen';

/** The key a stack's seen version is kept under. */
export const seenKey = (stack: string) => `bh-version-seen:${stack}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Notes `version` as seen under `key`, and tells every footer on the page. */
export function markVersionSeen(key: string, version: string): void {
  try {
    localStorage.setItem(key, version);
  } catch {
    // Storage refused: the dot stays until it is allowed.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

/** Whether `version` is newer than what this browser last saw under `key`. */
export function useSeenVersion(key: string, version: string): boolean {
  const [seen, setSeen] = useState(() => read(key));
  useEffect(() => {
    if (seen === null) {
      markVersionSeen(key, version);
    }
    const sync = () => setSeen(read(key));
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [key, version, seen]);
  return seen !== null && seen !== version;
}

/** Marks the version seen once the calling page is on screen. */
export function useMarkSeen(key: string, version: string): void {
  const mark = useCallback(() => markVersionSeen(key, version), [key, version]);
  useEffect(mark, [mark]);
}
