// ⌘K on Apple platforms, Ctrl K elsewhere: the one global search shortcut.

import { useHotkeys } from '@bh/hooks';

/**
 * Calls `handler` on the shortcut, anywhere on the page, a field's included.
 * Undefined turns it off, so two owners (the field, or an app's own search)
 * never both answer. The latest handler is read at key time, so a new
 * function each render does not re-register the listener.
 */
export function useSearchShortcut(handler: (() => void) | undefined): void {
  useHotkeys({
    keys: { 'mod+k': () => handler?.() },
    enabled: handler !== undefined,
    whileTyping: true,
  });
}
