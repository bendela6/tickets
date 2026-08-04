// Edge-kind visibility, as pills at the foot of the outline.
//
// These used to sit in the top bar beside the group chips. The top bar is now
// three controls (Lines / Fit / Rearrange) and everything that FILTERS what the
// canvas shows lives here, next to the group toggles it belongs with. A schema
// graph declares no kinds (schemaGraphToModel passes none), so this renders
// nothing on /schema — it exists for models that do.

import { useDiagramActions, useDiagramModel, useDiagramUi } from '../../state/diagram-context';
import { Chip } from './chip';

export function KindFilters() {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const actions = useDiagramActions();

  if (model.kinds.length === 0) return null;

  return (
    <div className="shrink-0 border-t-1 border-gray-6 pt-8">
      <p className="px-4 pb-6 text-11 uppercase tracking-wider text-gray-11">Edges</p>
      <div className="flex flex-wrap gap-4">
        {model.kinds.map((k) => (
          <Chip key={k.id} on={!ui.hidden.kinds.has(k.id)} onClick={() => actions.toggleKind(k.id)}>
            {k.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
