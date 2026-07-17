import { useCallback, useEffect, useRef, useState } from 'react';

// Output-based "busy" pulse: ping() on each output chunk; busy stays true for
// `idleMs` after the last chunk, then clears. Cleared on unmount.
export function useTerminalActivity(idleMs = 800): { busy: boolean; ping: () => void } {
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ping = useCallback(() => {
    setBusy(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBusy(false), idleMs);
  }, [idleMs]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { busy, ping };
}
