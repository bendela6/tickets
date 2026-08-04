// The right-hand panel's chrome is now the shared SidePanel: collapse toggle,
// drag-to-resize edge and persisted width all come from @tickets/ui. This file
// is left holding only the bounds the diagram wants and the content itself.

import { SidePanel as Panel } from '@tickets/ui';
import { DetailPanel } from './detail-panel';

export function SidePanel() {
  return (
    <Panel
      label="Details"
      side="right"
      storageKey="eer-detail"
      defaultWidth={320}
      minWidth={240}
      maxWidth={640}
      collapsible
      collapsedTo="rail"
    >
      <DetailPanel />
    </Panel>
  );
}
