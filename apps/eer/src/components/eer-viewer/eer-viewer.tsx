import { useState } from 'react';

import type { CheckResult } from '../../engine/model/types';
import { useModelLoader } from '../../hooks/use-model-loader';
import { useDiagramActions } from '../../state/diagram-context';
import { DiagramProvider } from '../../state/diagram-provider';
import { ChecksOverlay } from '../checks-overlay';
import { DetailPanel } from '../detail-panel';
import { Diagram } from '../diagram/diagram';
import { ErrorBanner } from '../error-banner';
import { TopBar } from '../top-bar';

function Viewer() {
  const { diagnostics, dismiss } = useModelLoader();
  const actions = useDiagramActions();
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  return (
    <div className="flex h-screen flex-col">
      <TopBar onSelfCheck={() => setChecks(actions.runChecks())} />
      <div className="flex min-h-0 flex-1">
        <Diagram>
          <ErrorBanner errors={diagnostics.errors} warnings={diagnostics.warnings} onDismiss={dismiss} />
          {checks && <ChecksOverlay results={checks} onClose={() => setChecks(null)} />}
        </Diagram>
        <DetailPanel />
      </div>
    </div>
  );
}

export function EerViewer() {
  return (
    <DiagramProvider>
      <Viewer />
    </DiagramProvider>
  );
}
