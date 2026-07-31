import { useEffect } from 'react';
import type { Model } from '../../engine/model/types';
import { useDiagramActions } from '../../state/diagram-context';
import { DiagramProvider } from '../../state/diagram-provider';
import { SidePanel } from '../detail-panel';
import { Diagram } from '../diagram/diagram';
import { TopBar } from '../top-bar';

// Read-only shell: no modal host, no self-fetch. The old `useModelLoader` hook
// (self-fetching a model via ?model=/?id= or the bundled default JSON) does
// not come along — this module fetches nothing and reads no URL params. A
// real model arrives as a prop (see EerDiagram below); ModelLoader is the only
// thing that turns it into diagram state.
function Viewer() {
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
// would re-load on every render; that stability is Task 8's job at the call
// site, not this component's.
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

export function EerDiagram({ model }: { model: Model }) {
  return (
    <DiagramProvider>
      <ModelLoader model={model} />
      <Viewer />
    </DiagramProvider>
  );
}
