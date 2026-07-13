// Fetch ?model= / ?id= (or the first model the API lists, or the bundled
// default), validate, LOAD, and re-pack once webfonts are ready so measured
// card widths are correct (legacy load()).
//
// Priority: ?model=<url> (arbitrary fetch, unchanged) > ?id=<slug> (a saved
// model via the dev-only models API) > the first model the API lists > the
// bundled default JSON. The API branches fall back to the bundled default
// whenever the API itself has nothing to offer (production build, or the
// request fails outright) — only an explicit ?model=/?id= surfaces its own
// fetch failure as a diagnostic instead of silently substituting the default.

import { useEffect, useState } from 'react';

import { getModel, listModels } from '../../api/models-client';
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

    const apply = (raw: unknown, modelId?: string) => {
      if (cancelled) return;
      const result = loadModel(raw);
      setDiagnostics({ errors: result.errors, warnings: result.warnings });
      if (!result.errors.length && result.model) {
        actions.load(result.model, modelId);
        const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
        if (fonts?.ready)
          void fonts.ready.then(() => {
            if (!cancelled) actions.repackAndFit();
          });
      }
    };

    const params = new URL(window.location.href).searchParams;
    const modelUrl = params.get('model');
    const modelId = params.get('id');

    if (modelUrl) {
      fetch(modelUrl, { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((raw: unknown) => apply(raw))
        .catch((err: unknown) => {
          if (!cancelled)
            setDiagnostics({
              errors: [`Could not load ${modelUrl}: ${err instanceof Error ? err.message : String(err)}`],
              warnings: [],
            });
        });
    } else if (modelId) {
      getModel(modelId)
        .then((raw) => apply(raw, modelId))
        .catch((err: unknown) => {
          if (!cancelled)
            setDiagnostics({
              errors: [`Could not load model "${modelId}": ${err instanceof Error ? err.message : String(err)}`],
              warnings: [],
            });
        });
    } else {
      listModels()
        .then((list) => {
          if (cancelled) return undefined;
          const first = list && list.length > 0 ? list[0] : null;
          if (!first) {
            apply(defaultModelJson);
            return undefined;
          }
          return getModel(first.id).then((raw) => apply(raw, first.id));
        })
        .catch(() => {
          if (!cancelled) apply(defaultModelJson);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [actions]);

  return { diagnostics, dismiss: () => setDiagnostics({ errors: [], warnings: [] }) };
}
