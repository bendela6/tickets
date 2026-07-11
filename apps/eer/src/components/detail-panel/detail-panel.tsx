import type { EerDiagram } from '../../engine/diagram/eer-diagram';
import type { Model, Selection } from '../../engine/model/types';
import { EdgeDetail } from './edge-detail';
import { EmptyState } from './empty-state';
import { EntityDetail } from './entity-detail';
import { GroupDetail } from './group-detail';

interface DetailPanelProps {
  engine: EerDiagram | null;
  model: Model | null;
  selection: Selection;
}

export function DetailPanel({ engine, model, selection }: DetailPanelProps) {
  return (
    <aside className="w-[320px] overflow-auto border-l border-border bg-surface text-[0.8rem]">
      {model && selection.type === 'entity' && <EntityDetail engine={engine} model={model} id={selection.id} />}
      {model && selection.type === 'group' && <GroupDetail engine={engine} model={model} id={selection.id} />}
      {model && selection.type === 'edge' && <EdgeDetail engine={engine} model={model} id={selection.id} />}
      {(!model || selection.type === 'none') && <EmptyState model={model} />}
    </aside>
  );
}
