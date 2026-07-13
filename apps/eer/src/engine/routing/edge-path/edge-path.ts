// Pure path selection for one relationship: pick the shape for the current routing
// mode and return its `d` plus crow's-foot head `d`, instead of writing to SVG
// elements. `live` skips the routed polyline (drag feedback uses the cheap direct
// shape). This is now the only path-selection implementation — the legacy
// imperative engine's DOM-writing equivalent was deleted in T16.

import { edgeEndpoints } from '../../geometry/edge-endpoints';
import { endKinds, type EndKind } from '../../model/end-kinds';
import { PORT_GAP } from '../../geometry/metrics';
import { orthoPolyPath } from '../ortho-poly-path';
import { simpleOrtho } from '../simple-ortho';
import { smoothPath } from '../smooth-path';
import type { EdgeGeometry } from '../edge-geometry';
import type { Entity, Model, Point, Relationship, RoutingMode, Side } from '../../model/types';

export interface EdgePathD {
  d: string;
  head: string;
}

export function edgePath(
  model: Model,
  rel: Relationship,
  routing: RoutingMode,
  geometry: EdgeGeometry,
  live: boolean,
): EdgePathD {
  const { p1, p2, s, t, self, A } = edgeEndpoints(model, rel, geometry.slots.get(rel.id));
  let d: string;
  if (self) d = loopPath(p1, p2, A);
  else if (routing === 'curved') d = curvePath(p1, p2, s, t);
  else {
    const stored = geometry.routes.get(rel.id);
    const pts = !live && stored ? stored : simpleOrtho(p1, p2, s, t);
    d = routing === 'ortho' ? orthoPolyPath(pts) : smoothPath(pts);
  }
  return { d, head: headPath(rel, p1, p2, s, t, self) };
}

// ---- Endpoint heads (crow's-foot / tick), ERD cardinality notation ----

const HEAD_LEN = 8; // how far the crow's-foot apex sits out along the line
const HEAD_SPREAD = 4;

// A head at port p on side `side`: a crow's-foot whose apex rides the line and
// whose toes land on the pin bar, for the "many" end. The pin hugs the card
// edge, so the foot must fan outward — toward the card it would vanish under
// the card. The "one" end has no head — its amber pin bar is the marker.
function headSub(p: Point, side: Side, kind: EndKind): string {
  if (kind !== 'many') return '';
  const out = side === 'R' ? 1 : -1; // direction from the pin away from its card
  const s = HEAD_SPREAD;
  const ax = p.x + out * HEAD_LEN;
  return `M${ax} ${p.y}L${p.x} ${p.y - s}M${ax} ${p.y}L${p.x} ${p.y}M${ax} ${p.y}L${p.x} ${p.y + s}`;
}

function headPath(rel: Relationship, p1: Point, p2: Point, s: Side, t: Side, self: boolean): string {
  if (self) return '';
  const [ks, kt] = endKinds(rel.cardinality);
  return headSub(p1, s, ks) + headSub(p2, t, kt);
}

function curvePath(p1: Point, p2: Point, s: Side, t: Side): string {
  const dx = Math.max(38, Math.min(170, Math.abs(p2.x - p1.x) * 0.5));
  const c1x = p1.x + (s === 'R' ? dx : -dx);
  const c2x = p2.x + (t === 'R' ? dx : -dx);
  return `M ${p1.x} ${p1.y} C ${c1x} ${p1.y} ${c2x} ${p2.y} ${p2.x} ${p2.y}`;
}

function loopPath(p1: Point, p2: Point, e: Entity): string {
  const out = e.x + e._w + PORT_GAP + 56;
  return `M ${p1.x} ${p1.y} C ${out} ${p1.y} ${out} ${p2.y} ${p2.x} ${p2.y}`;
}
