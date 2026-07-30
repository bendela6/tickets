import { DiagramProvider } from '../../state/diagram-provider';
import { SidePanel } from '../detail-panel';
import { Diagram } from '../diagram/diagram';
import { TopBar } from '../top-bar';

// Read-only shell: no model loader, no modal host. The old `useModelLoader`
// hook (self-fetching a model via ?model=/?id= or the bundled default JSON)
// does not come along — this module fetches nothing and reads no URL params.
// A real model arrives as a prop in a later task (EerViewer -> EerDiagram),
// which is also where diagnostics (errors/warnings) get a source again.
function Viewer() {
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Diagram />
        <SidePanel />
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
