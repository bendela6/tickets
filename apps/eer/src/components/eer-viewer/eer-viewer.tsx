import { useEffect, useRef, useState } from 'react';

import { EerDiagram } from '../../engine/diagram/eer-diagram';
import { loadModel } from '../../engine/model/load-model';
import type { CheckResult, Model, RoutingMode, Selection } from '../../engine/model/types';
import defaultModelJson from '../../model/eer-model.json';
import { ChecksOverlay } from '../checks-overlay';
import { DetailPanel } from '../detail-panel';
import { ErrorBanner } from '../error-banner';
import { TopBar } from '../top-bar';

interface Diagnostics {
  errors: string[];
  warnings: string[];
}

export function EerViewer() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EerDiagram | null>(null);

  const [model, setModel] = useState<Model | null>(null);
  const [selection, setSelection] = useState<Selection>({ type: 'none' });
  const [routing, setRouting] = useState<RoutingMode>('curved');
  const [hiddenGroups, setHiddenGroups] = useState<ReadonlySet<string>>(new Set());
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<string>>(new Set());
  const [colors, setColors] = useState<ReadonlyMap<string, string>>(new Map());
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({ errors: [], warnings: [] });

  useEffect(() => {
    const viewport = viewportRef.current;
    const mount = mountRef.current;
    if (!viewport || !mount) return;

    const engine = new EerDiagram(viewport, mount, { onSelect: setSelection });
    engineRef.current = engine;
    if (import.meta.env.DEV) (window as unknown as { __eer: EerDiagram }).__eer = engine;

    const apply = (raw: unknown) => {
      const result = loadModel(raw);
      setDiagnostics({ errors: result.errors, warnings: result.warnings });
      if (!result.errors.length && result.model) {
        engine.load(result.model);
        setModel(result.model);
        setRouting(result.model.view.routing);
      }
    };

    const modelUrl = new URL(window.location.href).searchParams.get('model');
    if (modelUrl) {
      fetch(modelUrl, { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(apply)
        .catch((err: unknown) =>
          setDiagnostics({ errors: [`Could not load ${modelUrl}: ${err instanceof Error ? err.message : String(err)}`], warnings: [] }),
        );
    } else {
      apply(defaultModelJson);
    }

    return () => engine.destroy();
  }, []);

  const engine = engineRef.current;

  const cycleRouting = () => {
    const order: RoutingMode[] = ['curved', 'avoid', 'ortho'];
    const next = order[(order.indexOf(routing) + 1) % order.length]!;
    engine?.setRouting(next);
    setRouting(next);
  };

  const toggleGroup = (id: string) => {
    const next = new Set(hiddenGroups);
    const hide = !next.has(id);
    if (hide) next.add(id);
    else next.delete(id);
    engine?.setGroupHidden(id, hide);
    setHiddenGroups(next);
  };

  const changeColors = (next: ReadonlyMap<string, string>) => {
    engine?.setColors(next);
    setColors(next);
  };

  const toggleKind = (id: string) => {
    const next = new Set(hiddenKinds);
    const hide = !next.has(id);
    if (hide) next.add(id);
    else next.delete(id);
    engine?.setKindHidden(id, hide);
    setHiddenKinds(next);
  };

  return (
    <div className="grid h-screen grid-rows-[auto_1fr]">
      <TopBar
        engine={engine}
        model={model}
        routing={routing}
        onCycleRouting={cycleRouting}
        hiddenGroups={hiddenGroups}
        hiddenKinds={hiddenKinds}
        colors={colors}
        onToggleGroup={toggleGroup}
        onToggleKind={toggleKind}
        onFit={() => engine?.fit()}
        onRearrange={() => engine?.rearrange()}
        onSelfCheck={() => setChecks(engine?.runChecks() ?? null)}
      />

      <div className="grid min-h-0 grid-cols-[1fr_auto]">
        <div ref={viewportRef} className="viewport">
          <div ref={mountRef} className="absolute inset-0" />
          <ErrorBanner
            errors={diagnostics.errors}
            warnings={diagnostics.warnings}
            onDismiss={() => setDiagnostics({ errors: [], warnings: [] })}
          />
          {checks && <ChecksOverlay results={checks} onClose={() => setChecks(null)} />}
        </div>

        <DetailPanel engine={engine} model={model} selection={selection} colors={colors} onColorsChange={changeColors} />
      </div>
    </div>
  );
}
