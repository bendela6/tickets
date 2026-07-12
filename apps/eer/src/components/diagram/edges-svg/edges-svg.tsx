import { useMemo } from 'react';
import { fieldEdges } from '../../../engine/focus/field-edges';
import { useDiagramModel, useDiagramUi } from '../../../state/diagram-context';
import { cn } from '../../../ui/cn';
import { useFocusSets, useHiddenIds } from '../entity-cards';
import { Edge } from './edge';

export function EdgesSvg() {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const focusSets = useFocusSets();
  const hidden = useHiddenIds();
  const fieldHot = useMemo(
    () =>
      ui.fieldHighlight
        ? fieldEdges(model, ui.fieldHighlight.entityId, ui.fieldHighlight.field)
        : null,
    [model, ui.fieldHighlight],
  );
  // The raised edge renders last — SVG paint order replaces the legacy appendChild raise.
  const rels = useMemo(() => {
    if (!ui.raisedEdge) return model.relationships;
    const raised = model.relById.get(ui.raisedEdge);
    return raised
      ? [...model.relationships.filter((r) => r.id !== ui.raisedEdge), raised]
      : model.relationships;
  }, [model, ui.raisedEdge]);
  return (
    <svg
      data-edges=""
      data-top={ui.focus?.type === 'edge' ? '' : undefined}
      className={cn('pointer-events-none absolute left-0 top-0 z-1 overflow-visible', {
        'z-3': ui.focus?.type === 'edge',
      })}
      width={model._content.w}
      height={model._content.h}
    >
      {rels.map((rel) => (
        <Edge
          key={rel.id}
          rel={rel}
          active={focusSets?.edges.has(rel.id) ?? false}
          dim={!!focusSets && !focusSets.edges.has(rel.id)}
          forcedHot={
            (fieldHot?.has(rel.id) ?? false) ||
            (ui.focus?.type === 'edge' && ui.focus.id === rel.id)
          }
          hidden={hidden.edges.has(rel.id)}
        />
      ))}
    </svg>
  );
}
