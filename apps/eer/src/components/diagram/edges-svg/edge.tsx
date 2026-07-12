import { memo, useMemo, useState, type CSSProperties } from 'react';
import { edgePath } from '../../../engine/routing/edge-path';
import { entityColor } from '../../../engine/colors/entity-color';
import { useDiagramDispatch, useDiagramGeometry, useDiagramModel, useDiagramUi, useDiagramView } from '../../../state/diagram-context';
import type { Relationship } from '../../../engine/model/types';

interface EdgeProps { rel: Relationship; active: boolean; dim: boolean; forcedHot: boolean; hidden: boolean }

export const Edge = memo(function Edge({ rel, active, dim, forcedHot, hidden }: EdgeProps) {
  const model = useDiagramModel();
  const view = useDiagramView();
  const ui = useDiagramUi();
  const geometry = useDiagramGeometry();
  const dispatch = useDiagramDispatch();
  const [hover, setHover] = useState(false);

  // Live shape while this edge's endpoints are mid-gesture (legacy `fast` redraw):
  // entity drag → only that entity's edges; group drag → all edges; resize/idle → routed.
  const g = ui.gesture;
  const live =
    g.kind === 'group' || (g.kind === 'entity' && (rel.source === g.id || rel.target === g.id));
  const { d, head } = useMemo(
    () => edgePath(model, rel, view.routing, geometry, live),
    [model, rel, view.routing, geometry, live],
  );

  const dashed = model.kindStyle.get(rel.kind ?? '') === 'dashed';
  const cls = ['edge', (forcedHot || hover) && !dim && 'hot', active && 'active', dim && 'dim', hidden && 'hidden']
    .filter(Boolean).join(' ');
  return (
    <g
      className={cls}
      data-rel={rel.id}
      data-kind={rel.kind || ''}
      style={{ '--edge-c': entityColor(model, rel.target, ui.colors) } as CSSProperties}
      onMouseEnter={() => { if (!dim) { setHover(true); dispatch({ type: 'RAISE_EDGE', id: rel.id }); } }}
      onMouseLeave={() => setHover(false)}
      onClick={() => dispatch({ type: 'ISOLATE_EDGE', id: rel.id })}
    >
      <path className="edge-hit" d={d} />
      <path className="edge-casing" d={d} />
      <path className={'edge-path' + (dashed ? ' dashed' : '')} d={d} />
      <path className="edge-head" d={head} />
    </g>
  );
});
