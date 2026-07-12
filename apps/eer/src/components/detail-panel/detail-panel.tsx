import { useDiagramActions, useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { EdgeDetail } from './edge-detail';
import { EmptyState } from './empty-state';
import { EntityDetail } from './entity-detail';
import { GroupDetail } from './group-detail';

export function DetailPanel() {
  const model = useDiagramModelOrNull();
  const ui = useDiagramUi();
  const actions = useDiagramActions();
  const selection = ui.panelSelection;
  const colors = ui.colors;

  return (
    <aside className="w-80 shrink-0 overflow-auto border-l border-gray-600 bg-gray-900 text-base">
      {model && selection.type === 'entity' && <EntityDetail model={model} id={selection.id} colors={colors} />}
      {model && selection.type === 'group' && <GroupDetail model={model} id={selection.id} colors={colors} />}
      {model && selection.type === 'edge' && <EdgeDetail model={model} id={selection.id} colors={colors} />}
      {(!model || selection.type === 'none') && (
        <EmptyState model={model} colors={colors} onColorsChange={actions.setColors} />
      )}
    </aside>
  );
}
