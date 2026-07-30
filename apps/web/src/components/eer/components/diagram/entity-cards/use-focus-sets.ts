// Which entities/edges stay lit for the current canvas focus — memoized pure sets.

import { useMemo } from 'react';
import { isolatedEdge } from '../../../engine/focus/isolated-edge';
import { relatedToEntity } from '../../../engine/focus/related-to-entity';
import { relatedToGroup, type GroupRelatedSets } from '../../../engine/focus/related-to-group';
import type { RelatedSets } from '../../../engine/focus/related-to-entity';
import { useDiagramModel, useDiagramUi } from '../../../state/diagram-context';

export function useFocusSets(): (RelatedSets & Partial<Pick<GroupRelatedSets, 'litGroups'>>) | null {
  const model = useDiagramModel();
  const focus = useDiagramUi().focus;
  return useMemo(() => {
    if (!focus) return null;
    if (focus.type === 'entity') return relatedToEntity(model, focus.id);
    if (focus.type === 'group') return relatedToGroup(model, focus.id);
    return isolatedEdge(model, focus.id);
  }, [model, focus]);
}
