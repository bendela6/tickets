import { useMemo } from 'react';
import { connectedPorts } from '../../../engine/focus/connected-ports';
import { entityColor } from '../../../engine/colors/entity-color';
import { useDiagramGeometry, useDiagramModel, useDiagramUi } from '../../../state/diagram-context';
import { EntityCard } from './entity-card';
import { useFocusSets } from './use-focus-sets';
import { useHiddenIds } from './use-hidden-ids';

export function EntityCards() {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const geometry = useDiagramGeometry();
  const focusSets = useFocusSets();
  const hidden = useHiddenIds();
  const connected = useMemo(() => connectedPorts(model, hidden.edges), [model, hidden.edges]);
  return (
    <div className="layer cards absolute left-0 top-0 z-2">
      {model.entities.map((e) => {
        const related = focusSets?.entities.has(e.id) ?? false;
        return (
          <EntityCard
            key={e.id}
            entity={e}
            color={entityColor(model, e.id, ui.colors)}
            dim={!!focusSets && !related}
            focus={!!focusSets && related}
            selected={ui.focus?.type === 'entity' && ui.focus.id === e.id}
            hidden={hidden.entities.has(e.id)}
            connected={connected}
            pinSpan={geometry.pinSpan}
          />
        );
      })}
    </div>
  );
}
