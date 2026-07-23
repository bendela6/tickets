import { memo, useMemo, useState } from 'react';
import { edgePath } from '../../../engine/routing/edge-path';
import { entityColor } from '../../../engine/colors/entity-color';
import {
  useDiagramDispatch,
  useDiagramGeometry,
  useDiagramModel,
  useDiagramUi,
  useDiagramView,
} from '../../../state/diagram-context';
import type { Relationship } from '../../../engine/model/types';
import { cn } from '@tickets/ui/cn';
import { runtimeStyle } from '@tickets/ui/runtime-style';

interface EdgeProps {
  rel: Relationship;
  active: boolean;
  dim: boolean;
  forcedHot: boolean;
  hidden: boolean;
}

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
  const hot = (forcedHot || hover) && !dim;
  const emphasized = hot || active;
  const cls = cn({ 'opacity-12': dim, 'hidden': hidden });
  return (
    <g
      className={cls}
      data-rel={rel.id}
      data-kind={rel.kind || ''}
      data-hot={hot ? '' : undefined}
      data-active={active ? '' : undefined}
      data-dim={dim ? '' : undefined}
      style={runtimeStyle({
        '--edge-c': entityColor(model, rel.source, ui.colors),
        '--edge-glow': `0 0 3px ${entityColor(model, rel.source, ui.colors)}`,
      })}
      onMouseEnter={() => {
        if (!dim) {
          setHover(true);
          dispatch({ type: 'RAISE_EDGE', id: rel.id });
        }
      }}
      onMouseLeave={() => setHover(false)}
      onClick={() => dispatch({ type: 'ISOLATE_EDGE', id: rel.id })}
    >
      <path className="cursor-pointer fill-none stroke-transparent" pointerEvents="stroke" strokeWidth={14} d={d} />
      <path className="fill-none stroke-gray-950" strokeLinecap="round" strokeWidth={4.5} d={d} />
      <path
        data-path=""
        data-dashed={dashed ? '' : undefined}
        className={cn('fill-none stroke-(--edge-c)', {
          'brightness-125 drop-shadow-(--edge-glow)': emphasized,
        })}
        strokeWidth={emphasized ? 2.8 : 1.8}
        strokeDasharray={dashed ? '5 4' : undefined}
        d={d}
      />
      <path
        className={cn('fill-none stroke-(--edge-c)', { 'brightness-125': emphasized })}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={emphasized ? 2.4 : 1.6}
        d={head}
      />
    </g>
  );
});
