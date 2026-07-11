// Routing — obstacle-avoiding orthogonal router for the "avoid" and "ortho" line
// modes. A* over a Hanan grid of lanes just outside each card finds a path from
// source port to target port through the gaps; the renderer draws those waypoints
// either smoothed (avoid) or as sharp H/V segments (ortho). "curved" ignores this.

import { edgeEndpoints, PORT_GAP } from './geometry';
import type { Model, Point, Relationship, Side } from './types';

const MARG = 16; // grid lane offset outside each card
const INFL = 10; // collision inflation; < MARG so boundary lanes stay free
const STUB = 20; // straight bit a line leaves its port with
const TURN = 34; // A* penalty per corner

interface Card {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function computeRoutes(model: Model): void {
  const cards: Card[] = model.entities.map((e) => ({ id: e.id, x: e.x, y: e.y, w: e._w, h: e._h }));
  for (const rel of model.relationships) {
    rel._route = rel.source === rel.target ? null : routePolyline(model, rel, cards);
  }
}

function routePolyline(model: Model, rel: Relationship, cards: Card[]): Point[] {
  const { p1, p2, s, t } = edgeEndpoints(model, rel);
  const a1: Point = { x: p1.x + (s === 'R' ? STUB : -STUB), y: p1.y };
  const b1: Point = { x: p2.x + (t === 'R' ? STUB : -STUB), y: p2.y };
  const obstacles = cards.filter((c) => c.id !== rel.source && c.id !== rel.target);

  const xset = new Set<number>([a1.x, b1.x]);
  const yset = new Set<number>([a1.y, b1.y]);
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
  const id = (ix: number, iy: number) => ix * H + iy;

  const start = id(xi.get(a1.x)!, yi.get(a1.y)!);
  const goal = id(xi.get(b1.x)!, yi.get(b1.y)!);

  const g = new Float64Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  const dirOf = new Int8Array(W * H).fill(0); // 1 = arrived horizontally, 2 = vertically
  g[start] = 0;

  const heur = (n: number) => Math.abs(X[(n / H) | 0]! - b1.x) + Math.abs(Y[n % H]! - b1.y);
  const open: [number, number][] = [[heur(start), start]];
  const done = new Uint8Array(W * H);
  let guard = 0;

  while (open.length && guard++ < 20000) {
    let best = 0;
    for (let k = 1; k < open.length; k++) if (open[k]![0] < open[best]![0]) best = k;
    const cur = open.splice(best, 1)[0]![1];
    if (cur === goal) break;
    if (done[cur]) continue;
    done[cur] = 1;
    const cx = (cur / H) | 0;
    const cy = cur % H;

    const steps: [number, number, number][] = [
      [cx - 1, cy, 1],
      [cx + 1, cy, 1],
      [cx, cy - 1, 2],
      [cx, cy + 1, 2],
    ];
    for (const [nx, ny, mdir] of steps) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const x1 = X[cx]!;
      const y1 = Y[cy]!;
      const x2 = X[nx]!;
      const y2 = Y[ny]!;
      if (segBlocked(x1, y1, x2, y2, obstacles)) continue;
      const len = Math.abs(x2 - x1) + Math.abs(y2 - y1);
      const turn = dirOf[cur] && dirOf[cur] !== mdir ? TURN : 0;
      const ng = g[cur]! + len + turn;
      const n = id(nx, ny);
      if (ng < g[n]!) {
        g[n] = ng;
        prev[n] = cur;
        dirOf[n] = mdir;
        open.push([ng + heur(n), n]);
      }
    }
  }

  if (!isFinite(g[goal]!)) return simpleOrtho(p1, p2, s, t);

  const grid: Point[] = [];
  for (let n = goal; n !== -1; n = prev[n]!) grid.push({ x: X[(n / H) | 0]!, y: Y[n % H]! });
  grid.reverse();
  return simplify([p1, ...grid, p2]);
}

export function simpleOrtho(p1: Point, p2: Point, s: Side, t: Side): Point[] {
  const a1: Point = { x: p1.x + (s === 'R' ? STUB : -STUB), y: p1.y };
  const b1: Point = { x: p2.x + (t === 'R' ? STUB : -STUB), y: p2.y };
  const mx = (a1.x + b1.x) / 2;
  return simplify([p1, a1, { x: mx, y: a1.y }, { x: mx, y: b1.y }, b1, p2]);
}

// ---- path builders ----

export function smoothPath(pts: Point[]): string {
  pts = dedupe(pts);
  if (pts.length < 3) return `M ${r(pts[0]!.x)} ${r(pts[0]!.y)} L ${r(last(pts).x)} ${r(last(pts).y)}`;
  let d = `M ${r(pts[0]!.x)} ${r(pts[0]!.y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const rad = Math.min(16, dist(p0, p1) / 2, dist(p1, p2) / 2);
    const a = toward(p1, p0, rad);
    const b = toward(p1, p2, rad);
    d += ` L ${r(a.x)} ${r(a.y)} Q ${r(p1.x)} ${r(p1.y)} ${r(b.x)} ${r(b.y)}`;
  }
  d += ` L ${r(last(pts).x)} ${r(last(pts).y)}`;
  return d;
}

export function orthoPolyPath(pts: Point[]): string {
  pts = dedupe(pts);
  let d = `M ${r(pts[0]!.x)} ${r(pts[0]!.y)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${r(pts[i]!.x)} ${r(pts[i]!.y)}`;
  return d;
}

export function polyMidpoint(pts: Point[]): Point {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!);
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = dist(a, b);
    if (half <= d) {
      const k = d ? half / d : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    half -= d;
  }
  return last(pts);
}

// ---- helpers ----

function segBlocked(x1: number, y1: number, x2: number, y2: number, obstacles: Card[]): boolean {
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

function simplify(pts: Point[]): Point[] {
  pts = dedupe(pts);
  const out: Point[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (!collinear) out.push(b);
  }
  out.push(last(pts));
  return out;
}

function dedupe(pts: Point[]): Point[] {
  const out: Point[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const q = out[out.length - 1]!;
    if (Math.abs(p.x - q.x) > 0.01 || Math.abs(p.y - q.y) > 0.01) out.push(p);
  }
  return out;
}

function toward(from: Point, to: Point, d: number): Point {
  const len = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / len) * d, y: from.y + ((to.y - from.y) / len) * d };
}
function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function last(a: Point[]): Point {
  return a[a.length - 1]!;
}
function r(n: number): number {
  return Math.round(n * 10) / 10;
}

export { PORT_GAP };
