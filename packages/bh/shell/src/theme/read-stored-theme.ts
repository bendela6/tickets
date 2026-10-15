// Where the first render gets its theme from: the stored preference, or `system`.

import { readStored } from '@bh/hooks';
import type { ThemePreference } from './theme-types';

/**
 * The preference stored under the app's key, or `system` when there is none.
 *
 * An unset preference resolves to the OS theme anyway, so the painted result is
 * the same as reading `prefers-color-scheme` here — but returning `system`
 * keeps "never chose" distinguishable from "chose the theme the OS happens to
 * be on", which is the distinction a three-way control shows.
 *
 * @param storageKey The key `applyTheme` stored it under, the app's own.
 * @returns The stored preference, or `system` for none, an unknown value, or no storage.
 */
export function readStoredTheme(storageKey: string): ThemePreference {
  const stored = readStored(storageKey);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}
