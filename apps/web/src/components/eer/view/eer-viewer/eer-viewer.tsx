import { useEffect, type ReactNode } from 'react';
import type { Model } from '../../engine/model/types';
import { useDiagramActions } from '../../state/diagram-context';
import { DiagramProvider } from '../../state/diagram-provider';
import { SidePanel } from '../detail-panel';
import { Diagram } from '../diagram/diagram';
import { Outline } from '../outline';
import { TopBar } from '../top-bar';

// Loads `model` into the reducer whenever its identity changes, then re-packs
// once webfonts are ready. Measured card widths are wrong before fonts load —
// the deleted `use-model-loader` did this same fonts.ready re-pack, and the
// behaviour has to survive the move. Renders nothing; it exists purely to run
// the effect inside <DiagramProvider>, where useDiagramActions is available.
//
// `cancelled` guards the fonts.ready continuation the same way the deleted
// `use-model-loader` did: fonts.ready is a promise that can resolve well after
// this effect's cleanup has run, and without the flag a stale repackAndFit()
// from a since-replaced `model` would still fire — clobbering pan/zoom the
// user has already set on whatever model is current by then.
//
// No effect loop: `actions` is a useMemo'd value with an empty dep array (see
// diagram-provider.tsx), so its identity never changes across renders — only
// a genuine change of the `model` prop re-fires this effect. Callers must keep
// `model` referentially stable (e.g. useMemo keyed on the source data) or this
// would re-load on every render; that stability is the call site's job, not
// this component's.
function ModelLoader({ model }: { model: Model }) {
  const actions = useDiagramActions();
  useEffect(() => {
    let cancelled = false;
    actions.load(model);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready)
      void fonts.ready.then(() => {
        if (!cancelled) actions.repackAndFit();
      });
    return () => {
      cancelled = true;
    };
  }, [actions, model]);
  return null;
}

/**
 * Diagram state for everything inside it.
 *
 * Separate from the canvas so the two can sit in DIFFERENT parts of a page: on
 * /schema the outline renders in the app shell's left panel and the canvas in
 * the shell's main area, and only a provider wrapped around the whole shell can
 * feed both. `model` is nullable because the shell must still mount while the
 * schema is loading, missing, or empty.
 */
export function EerDiagramProvider({
  model,
  children,
}: {
  model: Model | null;
  children: ReactNode;
}) {
  return (
    <DiagramProvider>
      {model ? <ModelLoader model={model} /> : null}
      {children}
    </DiagramProvider>
  );
}

/**
 * The drawing surface: toolbar, canvas, detail panel. Must be rendered inside
 * <EerDiagramProvider>. No `h-screen` of its own — it fills whatever height its
 * container gives it.
 */
export function EerCanvas() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Diagram />
        <SidePanel />
      </div>
    </div>
  );
}

/**
 * The whole viewer as one component — outline on the left, canvas on the right.
 *
 * Read-only: no modal host, no self-fetch. The old `useModelLoader` hook
 * (self-fetching a model via ?model=/?id= or the bundled default JSON) does not
 * come along; a model arrives as a prop and ModelLoader is the only thing that
 * turns it into diagram state.
 *
 * /schema does NOT use this — it composes the three pieces itself so the
 * outline can live in the app shell. This is the standalone form, for a host
 * that has no sidebar of its own to lend.
 */
export function EerDiagram({ model }: { model: Model }) {
  return (
    <EerDiagramProvider model={model}>
      <div className="flex h-full min-h-0">
        <aside className="flex w-256 flex-none flex-col gap-8 border-r-1 border-gray-6 bg-gray-2 p-12">
          <h1 className="text-14 font-600 tracking-tight">
            {model.meta.title ?? 'Database schema'}
          </h1>
          <Outline />
        </aside>
        <div className="min-w-0 flex-1">
          <EerCanvas />
        </div>
      </div>
    </EerDiagramProvider>
  );
}
