import { useModelLoader } from '../../hooks/use-model-loader';
import { DiagramProvider } from '../../state/diagram-provider';
import { SidePanel } from '../detail-panel';
import { Diagram } from '../diagram/diagram';
import { EditorModals } from '../editor';
import { ErrorBanner } from '../error-banner';
import { TopBar } from '../top-bar';

function Viewer() {
  const { diagnostics, dismiss } = useModelLoader();
  return (
    <EditorModals>
      <div className="flex h-screen flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <Diagram>
            <ErrorBanner errors={diagnostics.errors} warnings={diagnostics.warnings} onDismiss={dismiss} />
          </Diagram>
          <SidePanel />
        </div>
      </div>
    </EditorModals>
  );
}

export function EerViewer() {
  return (
    <DiagramProvider>
      <Viewer />
    </DiagramProvider>
  );
}
