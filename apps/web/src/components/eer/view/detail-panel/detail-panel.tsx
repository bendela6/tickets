import { useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { EdgeDetail } from './edge-detail';
import { EmptyState } from './empty-state';
import { EntityDetail } from './entity-detail';
import { GroupDetail } from './group-detail';

export function DetailPanel() {
  const model = useDiagramModelOrNull();
  const ui = useDiagramUi();
  const selection = ui.panelSelection;
  const colors = ui.colors;

  // Content only — the <aside> chrome (width, border, collapse/resize) lives in
  // SidePanel, which wraps this. Kept as its own component so the selection
  // routing stays testable without the panel chrome.
  return (
    <div className="text-13">
      {model && selection.type === 'entity' && <EntityDetail model={model} id={selection.id} colors={colors} />}
      {model && selection.type === 'group' && <GroupDetail model={model} id={selection.id} colors={colors} />}
      {model && selection.type === 'edge' && <EdgeDetail model={model} id={selection.id} colors={colors} />}
      {(!model || selection.type === 'none') && <EmptyState model={model} />}
    </div>
  );
}
