import { useMemo } from 'react';
import { hiddenIds, type HiddenIds } from '../../../engine/focus/hidden-ids';
import { useDiagramModel, useDiagramUi } from '../../../state/diagram-context';

export function useHiddenIds(): HiddenIds {
  const model = useDiagramModel();
  const hidden = useDiagramUi().hidden;
  return useMemo(() => hiddenIds(model, hidden.groups, hidden.kinds), [model, hidden]);
}
