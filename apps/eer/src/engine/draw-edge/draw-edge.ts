// Draw one relationship: pick the path for the current routing mode, write it to
// the edge's SVG elements, and draw the crow's-foot heads. `live` skips the routed
// polyline (drag feedback uses the cheap direct shape).

import { edgeEndpoints } from '../edge-endpoints';
import { endKinds, type EndKind } from '../end-kinds';
import { PORT_GAP } from '../metrics';
import { orthoPolyPath } from '../ortho-poly-path';
import { simpleOrtho } from '../simple-ortho';
import { smoothPath } from '../smooth-path';
import type { EngineState, Entity, Point, Relationship, Side } from '../types';

export function drawEdge(state: EngineState, rel: Relationship, live: boolean): void {
  const els = state.els.edgeEls.get(rel.id);
  if (!els) return;
  const { p1, p2, s, t, self, A } = edgeEndpoints(state.model, rel);
  const mode = state.view.routing;

  let d: string;
  if (self) {
    d = loopPath(p1, p2, A);
  } else if (mode === 'curved') {
    d = curvePath(p1, p2, s, t);
  } else {
    const pts = !live && rel._route ? rel._route : simpleOrtho(p1, p2, s, t);
    d = mode === 'ortho' ? orthoPolyPath(pts) : smoothPath(pts);
  }

  els.path.setAttribute('d', d);
  els.casing.setAttribute('d', d);
  els.hit.setAttribute('d', d);
  els.head.setAttribute('d', headPath(rel, p1, p2, s, t, self));
}

// ---- Endpoint heads (crow's-foot / tick), ERD cardinality notation ----

const HEAD_LEN = 8; // reaches ~the card edge from the port
const HEAD_SPREAD = 4;

// A head at port p on side `side`: a crow's-foot fanning toward the card for the
// "many" end. The "one" end has no head — its amber pin bar is the marker.
function headSub(p: Point, side: Side, kind: EndKind): string {
  if (kind !== 'many') return '';
  const toCard = side === 'R' ? -1 : 1; // direction from the port toward its card
  const s = HEAD_SPREAD;
  const cx = p.x + toCard * HEAD_LEN;
  return `M${p.x} ${p.y}L${cx} ${p.y - s}M${p.x} ${p.y}L${cx} ${p.y}M${p.x} ${p.y}L${cx} ${p.y + s}`;
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
