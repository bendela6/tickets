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
import { cn, runtimeStyle } from '@tickets/ui';
import { mix } from '../../../ui/color-mix';

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
  const color = entityColor(model, rel.source, ui.colors);
  // Emphasis colour. This was `brightness-125`, which is only ever "stronger"
  // on a dark canvas: Instrument's step 9 flips luminance across themes
  // (blue-9 = #2a5dae light / #8bb4ef dark), so brightening the light theme's
  // dark stroke moved it TOWARD the near-white page — blue 5.93:1 -> 4.17:1,
  // green 5.53 -> 3.84, yellow 4.68 -> 3.16. Hovering a relationship made it
  // ~30% FAINTER while also thickening it, which reads as a smear.
  //
  // gray-12 is the ink token, so it flips with the theme too (near-black on
  // light, near-white on dark). Mixing the hue toward it therefore moves the
  // stroke AWAY from the page in BOTH themes: blue 5.93 -> 7.04 light and
  // 8.18 -> 9.14 dark; yellow, the weakest hue, 4.68 -> 5.76 light.
  const hotColor = mix(color, 82, 'var(--color-gray-12)');
  return (
    <g
      className={cls}
      data-rel={rel.id}
      data-kind={rel.kind || ''}
      data-hot={hot ? '' : undefined}
      data-active={active ? '' : undefined}
      data-dim={dim ? '' : undefined}
      style={runtimeStyle({
        '--edge-c': color,
        '--edge-hot': hotColor,
        // The glow rides the emphasis colour, not the base one: a halo in the
        // stronger colour reinforces the width bump instead of ringing the
        // line in something closer to the background.
        '--edge-glow': `0 0 3px ${hotColor}`,
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
      <path className="fill-none stroke-gray-1" strokeLinecap="round" strokeWidth={4.5} d={d} />
      <path
        data-path=""
        data-dashed={dashed ? '' : undefined}
        className={cn(
          'fill-none',
          emphasized ? 'stroke-(--edge-hot) drop-shadow-(--edge-glow)' : 'stroke-(--edge-c)',
        )}
        strokeWidth={emphasized ? 2.8 : 1.8}
        strokeDasharray={dashed ? '5 4' : undefined}
        d={d}
      />
      <path
        className={cn('fill-none', emphasized ? 'stroke-(--edge-hot)' : 'stroke-(--edge-c)')}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={emphasized ? 2.4 : 1.6}
        d={head}
      />
    </g>
  );
});
