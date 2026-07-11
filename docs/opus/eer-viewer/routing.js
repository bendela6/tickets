// Routing — obstacle-avoiding orthogonal router for the "avoid" and "ortho" line
// modes. Finds a path from source port to target port through the gaps between
// cards (A* over a Hanan grid of lanes just outside each card), then the renderer
// draws those waypoints either smoothed (avoid) or as sharp H/V segments (ortho).
//
// "curved" mode ignores this entirely — it draws a direct bézier in render.js.

import { edgeEndpoints, PORT_GAP } from './geometry.js';

const MARG = 16; // grid lane offset outside each card
const INFL = 10; // collision inflation; < MARG so boundary lanes stay free
const STUB = 20; // straight bit a line leaves its port with, before it may turn
const TURN = 34; // A* penalty per corner (prefers straighter paths)

// Fill rel._route (an array of world points) for every non-self edge.
export function computeRoutes(state) {
  const model = state.model;
  const cards = model.entities.map((e) => ({ id: e.id, x: e.x, y: e.y, w: e._w, h: e._h }));
  for (const rel of model.relationships) {
    rel._route = rel.source === rel.target ? null : routePolyline(model, rel, cards);
  }
}

function routePolyline(model, rel, cards) {
  const { p1, p2, s, t } = edgeEndpoints(model, rel);
  const a1 = { x: p1.x + (s === 'R' ? STUB : -STUB), y: p1.y };
  const b1 = { x: p2.x + (t === 'R' ? STUB : -STUB), y: p2.y };
  const obstacles = cards.filter((c) => c.id !== rel.source && c.id !== rel.target);

  // candidate lanes: just outside every card, plus the two stub ends
  const xset = new Set([a1.x, b1.x]);
  const yset = new Set([a1.y, b1.y]);
  for (const c of cards) {
    xset.add(c.x - MARG);
    xset.add(c.x + c.w + MARG);
    yset.add(c.y - MARG);
    yset.add(c.y + c.h + MARG);
  }
  const X = [...xset].sort((m, n) => m - n);
  const Y = [...yset].sort((m, n) => m - n);
  const W = X.length;
  const H = Y.length;
  const xi = new Map(X.map((v, i) => [v, i]));
  const yi = new Map(Y.map((v, i) => [v, i]));
  const id = (ix, iy) => ix * H + iy;

  const start = id(xi.get(a1.x), yi.get(a1.y));
  const goal = id(xi.get(b1.x), yi.get(b1.y));

  const g = new Float64Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  const dirOf = new Int8Array(W * H).fill(0); // 1 = arrived horizontally, 2 = vertically
  g[start] = 0;

  const heur = (n) => Math.abs(X[(n / H) | 0] - b1.x) + Math.abs(Y[n % H] - b1.y);
  const open = [[heur(start), start]];
  const done = new Uint8Array(W * H);
  let guard = 0;

  while (open.length && guard++ < 20000) {
    let best = 0;
    for (let k = 1; k < open.length; k++) if (open[k][0] < open[best][0]) best = k;
    const [, cur] = open.splice(best, 1)[0];
    if (cur === goal) break;
    if (done[cur]) continue;
    done[cur] = 1;
    const cx = (cur / H) | 0;
    const cy = cur % H;

    // four orthogonal neighbours
    const steps = [
      [cx - 1, cy, 1],
      [cx + 1, cy, 1],
      [cx, cy - 1, 2],
      [cx, cy + 1, 2],
    ];
    for (const [nx, ny, mdir] of steps) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const x1 = X[cx];
      const y1 = Y[cy];
      const x2 = X[nx];
      const y2 = Y[ny];
      if (segBlocked(x1, y1, x2, y2, obstacles)) continue;
      const len = Math.abs(x2 - x1) + Math.abs(y2 - y1);
      const turn = dirOf[cur] && dirOf[cur] !== mdir ? TURN : 0;
      const ng = g[cur] + len + turn;
      const n = id(nx, ny);
      if (ng < g[n]) {
        g[n] = ng;
        prev[n] = cur;
        dirOf[n] = mdir;
        open.push([ng + heur(n), n]);
      }
    }
  }

  if (!isFinite(g[goal])) return simpleOrtho(p1, p2, s, t); // no path found → fallback

  const grid = [];
  for (let n = goal; n !== -1; n = prev[n]) grid.push({ x: X[(n / H) | 0], y: Y[n % H] });
  grid.reverse();
  return simplify([p1, ...grid, p2]);
}

// A basic exit-stub → vertical → enter-stub route (used live while dragging and as
// the fallback when A* can't find a path).
export function simpleOrtho(p1, p2, s, t) {
  const a1 = { x: p1.x + (s === 'R' ? STUB : -STUB), y: p1.y };
  const b1 = { x: p2.x + (t === 'R' ? STUB : -STUB), y: p2.y };
  const mx = (a1.x + b1.x) / 2;
  return simplify([p1, a1, { x: mx, y: a1.y }, { x: mx, y: b1.y }, b1, p2]);
}

// ---- path builders ----

// Rounded corners through the waypoints — the "avoid" (curvy) look.
export function smoothPath(pts) {
  pts = dedupe(pts);
  if (pts.length < 3) return `M ${r(pts[0].x)} ${r(pts[0].y)} L ${r(last(pts).x)} ${r(last(pts).y)}`;
  let d = `M ${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const rad = Math.min(16, dist(p0, p1) / 2, dist(p1, p2) / 2);
    const a = toward(p1, p0, rad);
    const b = toward(p1, p2, rad);
    d += ` L ${r(a.x)} ${r(a.y)} Q ${r(p1.x)} ${r(p1.y)} ${r(b.x)} ${r(b.y)}`;
  }
  d += ` L ${r(last(pts).x)} ${r(last(pts).y)}`;
  return d;
}

// Sharp H/V segments — the "ortho" look.
export function orthoPolyPath(pts) {
  pts = dedupe(pts);
  let d = `M ${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${r(pts[i].x)} ${r(pts[i].y)}`;
  return d;
}

// Arc-length midpoint of the polyline (for the cardinality label).
export function polyMidpoint(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (half <= d) {
      const k = d ? half / d : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
    }
    half -= d;
  }
  return last(pts);
}

// ---- collision + geometry helpers ----

function segBlocked(x1, y1, x2, y2, obstacles) {
  for (const c of obstacles) {
    const rx1 = c.x - INFL;
    const ry1 = c.y - INFL;
    const rx2 = c.x + c.w + INFL;
    const ry2 = c.y + c.h + INFL;
    if (y1 === y2) {
      if (y1 > ry1 && y1 < ry2 && Math.min(x1, x2) < rx2 && Math.max(x1, x2) > rx1) return true;
    } else {
      if (x1 > rx1 && x1 < rx2 && Math.min(y1, y2) < ry2 && Math.max(y1, y2) > ry1) return true;
    }
  }
  return false;
}

function simplify(pts) {
  pts = dedupe(pts);
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (!collinear) out.push(b);
  }
  out.push(last(pts));
  return out;
}

function dedupe(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const q = out[out.length - 1];
    if (Math.abs(p.x - q.x) > 0.01 || Math.abs(p.y - q.y) > 0.01) out.push(p);
  }
  return out;
}

function toward(from, to, d) {
  const len = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / len) * d, y: from.y + ((to.y - from.y) / len) * d };
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function last(a) {
  return a[a.length - 1];
}
function r(n) {
  return Math.round(n * 10) / 10;
}

export { PORT_GAP };
