// ⌘K on Apple platforms, Ctrl K elsewhere: the one global search shortcut.

import { useEffect, useRef } from 'react';
import { isAppleShortcutPlatform } from './is-apple-shortcut-platform';

/**
 * Calls `handler` on the shortcut, anywhere on the page. Undefined turns it
 * off, so two owners (the field, or an app's own search) never both answer.
 * The latest handler is read at key time, so a new function each render does
 * not re-register the listener.
 */
export function useSearchShortcut(handler: (() => void) | undefined): void {
  const latest = useRef(handler);
  latest.current = handler;
  const enabled = handler !== undefined;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = isAppleShortcutPlatform() ? event.metaKey : event.ctrlKey;
      if (!modifier || event.key !== 'k') {
        return;
      }
      event.preventDefault();
      latest.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}
