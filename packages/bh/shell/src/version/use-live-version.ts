// The version live on the server, when it is not the one running: checked
// whenever the window regains focus, from the build.json beside the app.

import { useEffect, useState } from 'react';
import type { BuildInfo } from './build-info';

/** The newer version the server has; null while it serves this one. Never checks on a dev server. */
export function useLiveVersion(info: BuildInfo): string | null {
  const [live, setLive] = useState<string | null>(null);
  useEffect(() => {
    if (info.dev) {
      return;
    }
    let stopped = false;
    const check = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      fetch(`${info.base}build.json`, { cache: 'no-store' })
        .then((response) => {
          return response.ok ? (response.json() as Promise<{ version?: string }>) : null;
        })
        .then((build) => {
          if (!stopped && build?.version && build.version !== info.stack.version) {
            setLive(build.version);
          }
        })
        .catch(() => {
          // Offline, or the server mid-deploy: the next focus checks again.
        });
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      stopped = true;
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [info]);
  return live;
}
