// Fetch ?model= (or the bundled default), validate, LOAD, and re-pack once
// webfonts are ready so measured card widths are correct (legacy load()).

import { useEffect, useState } from 'react';

import { loadModel } from '../../engine/model/load-model';
import defaultModelJson from '../../model/eer-model.json';
import { useDiagramActions } from '../../state/diagram-context';

export interface Diagnostics {
  errors: string[];
  warnings: string[];
}

export function useModelLoader(): { diagnostics: Diagnostics; dismiss: () => void } {
  const actions = useDiagramActions();
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({ errors: [], warnings: [] });

  useEffect(() => {
    let cancelled = false;

    const apply = (raw: unknown) => {
      if (cancelled) return;
      const result = loadModel(raw);
      setDiagnostics({ errors: result.errors, warnings: result.warnings });
      if (!result.errors.length && result.model) {
        actions.load(result.model);
        const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
        if (fonts?.ready)
          void fonts.ready.then(() => {
            if (!cancelled) actions.repackAndFit();
          });
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
        .catch((err: unknown) => {
          if (!cancelled)
            setDiagnostics({
              errors: [`Could not load ${modelUrl}: ${err instanceof Error ? err.message : String(err)}`],
              warnings: [],
            });
        });
    } else {
      apply(defaultModelJson);
    }
    return () => {
      cancelled = true;
    };
  }, [actions]);

  return { diagnostics, dismiss: () => setDiagnostics({ errors: [], warnings: [] }) };
}
