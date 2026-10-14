import { useEffect, useRef, useState } from 'react';

/**
 * Writes text to the clipboard, for a caller outside React: a table's cell
 * copy, a menu item's action. It never throws: a browser that refuses the
 * write (no permission, no clipboard, a page that isn't secure) resolves to
 * `false`.
 *
 * @param text The exact string written.
 * @returns Whether the clipboard took it.
 */
export async function copyText(text: string): Promise<boolean> {
  // Typed as always there, but absent on an insecure page and in some
  // embedded browsers.
  const clipboard = (navigator as Partial<Navigator>).clipboard;
  if (!clipboard) {
    return false;
  }
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** What `useCopy` returns: the copy, and whether the last one worked. */
export interface CopyState {
  /** True from a copy that worked until `resetMs` passes. */
  copied: boolean;
  /** True from a copy the browser refused until `resetMs` passes. */
  failed: boolean;
  /** Writes `text` to the clipboard; resolves to whether it was written. */
  copy: (text: string) => Promise<boolean>;
}

// One hook for the idle/copied/failed dance the apps each wrote with their own
// setTimeout (dsn-field, sdk-snippet, session-screen, item-detail).
/**
 * Copies text to the clipboard and holds whether it worked, for a button of
 * your own: `copy(text)`, then `copied` or `failed` until `resetMs` passes.
 *
 * @param resetMs How long `copied` or `failed` holds, in milliseconds.
 */
export function useCopy(resetMs = 1500): CopyState {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Cleanup only, deliberately not depending on `state` — clears whatever
  // timer is pending at unmount so no reset fires after the component is gone.
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string) => {
    const written = await copyText(text);
    setState(written ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), resetMs);
    return written;
  };
  return { copied: state === 'copied', failed: state === 'failed', copy };
}
