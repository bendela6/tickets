import { useEffect, useMemo, useRef, useState } from 'react';
import type { Board, View } from '../api/types';
import { usePatchView } from '../api/use-patch-view';
import { normalizeViewConfig, type ViewConfig } from '../utils/view-config';

// The view's config with optimistic local edits: every change renders
// immediately and is PATCHed to the view debounced, so table layout survives
// refresh on any machine.
export function useViewConfig(board: Board | undefined, view: View | undefined) {
  const patchView = usePatchView();
  const serverConfig = useMemo(
    () =>
      board
        ? normalizeViewConfig(view?.config ?? {}, board)
        : ({ columns: [], sort: null, filters: { rules: [] } } as ViewConfig),
    [view, board],
  );
  const [local, setLocal] = useState<ViewConfig | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(null);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, [view?.id]);

  const config = local ?? serverConfig;

  const update = (mutate: (current: ViewConfig) => ViewConfig) => {
    if (!view) {
      return;
    }
    const next = mutate(config);
    setLocal(next);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      patchView.mutate({ viewId: view.id, config: next });
    }, 600);
  };

  return { config, update };
}
