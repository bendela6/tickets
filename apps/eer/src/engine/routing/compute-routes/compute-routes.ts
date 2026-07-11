// Routing — obstacle-avoiding orthogonal router for the "avoid" and "ortho" line
// modes. A* over a Hanan grid of lanes just outside each card finds a path from
// source port to target port through the gaps; the renderer draws those waypoints
// either smoothed (avoid) or as sharp H/V segments (ortho). "curved" ignores this.
//
// Everything below computeRoutes() is that one pipeline's private machinery:
// lane separation, channel ordering, and port-slot reordering.

import { edgeEndpoints } from '../../geometry/edge-endpoints';
import { edgeSides } from '../../geometry/edge-sides';
import { STUB } from '../../geometry/metrics';
import { simpleOrtho } from '../simple-ortho';
import { simplifyPolyline } from '../simplify-polyline';
import { zoneIdOf } from '../../groups/zone-id-of';
import type { Model, Point, Relationship } from '../../model/types';

const MARG = 16; // grid lane offset outside each card
const INFL = 10; // collision inflation; < MARG so boundary lanes stay free
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
  const hEntries = separateLanes(model, cards);
  reorderPortSlots(model, hEntries);
}

// ---- Lane separation ----------------------------------------------------------
// The A* router keeps each edge off the cards but lets several edges share a lane,
// so parallel runs stack on top of each other. This nudges overlapping collinear
// segments into distinct lanes (like the reference's per-connection channels).
// It only moves interior waypoints — never a port endpoint (p1/p2) — so edges stay
// attached to their pins and the geometry self-checks still hold.

const LANE_STEP = 9; // spacing between separated parallel runs — exceeds the casing width
const MIN_SEP = LANE_STEP - 0.5; // minimum separation between overlapping parallel runs

function separateLanes(model: Model, cards: Card[]): ChannelEntry[] {
  separateAxis(model, cards, true); // vertical runs → spread along x
  // horizontal entries (incl. port stubs) feed the port-slot clash veto
  return separateAxis(model, cards, false); // horizontal runs → spread along y
}

interface LaneSeg {
  rel: Relationship;
  pts: Point[];
  i: number; // segment is pts[i] → pts[i+1]
  key: number; // shared coordinate (x for vertical, y for horizontal)
  lo: number;
  hi: number;
  fixed?: boolean; // port stubs: they claim their lane but can never move
}

function separateAxis(model: Model, cards: Card[], vertical: boolean): ChannelEntry[] {
  const segs: LaneSeg[] = [];
  for (const rel of model.relationships) {
    const pts = rel._route;
    if (!pts || pts.length < 2) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      // Horizontal port stubs (first + last segment) stay glued to the pins —
      // included as immovable lane-claims so nothing else is placed onto them
      // (simplify() can merge a stub into an arbitrarily long first segment).
      const fixed = !vertical && (i === 0 || i === pts.length - 2);
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (vertical && dx < 0.5 && dy > 1)
        segs.push({ rel, pts, i, key: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
      else if (!vertical && dy < 0.5 && dx > 1)
        segs.push({ rel, pts, i, key: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x), fixed });
    }
  }

  if (segs.length < 2) return segs.map((s) => ({ s, coord: s.key }));

  // ONE global pool per axis — every run checks separation against ALL previously
  // placed overlapping runs. (Clustering by coordinate is unsound: independent
  // clusters allocate blindly against each other and interleave lanes 2px apart,
  // or drop a run directly onto another cluster's trunk.)
  const placed: { lo: number; hi: number; coord: number }[] = [];
  const entries: ChannelEntry[] = [];
  // Immovable port stubs claim their coordinates up front.
  for (const s of segs)
    if (s.fixed) {
      placed.push({ lo: s.lo, hi: s.hi, coord: s.key });
      entries.push({ s, coord: s.key });
    }

  // Longest runs place first: big trunks keep their A* lane, short runs adjust.
  const movable = segs.filter((s) => !s.fixed).sort((a, b) => b.hi - b.lo - (a.hi - a.lo));
  for (const s of movable) {
    const near = placed.filter((p) => p.lo <= s.hi + 1 && p.hi >= s.lo - 1);
    let coord: number | null = null;
    outer: for (let j = 0; j <= 12; j++) {
      for (const c of j === 0 ? [s.key] : [s.key + j * LANE_STEP, s.key - j * LANE_STEP]) {
        if (near.some((p) => Math.abs(p.coord - c) < MIN_SEP)) continue;
        if (j > 0 && shiftBlocked(model, cards, s, c - s.key, vertical)) continue;
        coord = c;
        break outer;
      }
    }
    if (coord == null) coord = s.key; // every lane taken or blocked — stay put
    applyShift(s, coord - s.key, vertical);
    placed.push({ lo: s.lo, hi: s.hi, coord });
    entries.push({ s, coord });
  }

  orderChannels(model, cards, entries, vertical);
  return entries;
}

function applyShift(s: LaneSeg, d: number, vertical: boolean): void {
  if (Math.abs(d) < 0.01) return;
  const a = s.pts[s.i]!;
  const b = s.pts[s.i + 1]!;
  if (vertical) {
    a.x += d;
    b.x += d;
  } else {
    a.y += d;
    b.y += d;
  }
}

// ---- Channel ordering ----------------------------------------------------------
// Lane ALLOCATION spreads runs apart but assigns lanes in an arbitrary order, so a
// bundle can braid: the order of lines in one corridor won't match their order at
// the pins or in the next corridor. This pass reorders parallel runs within each
// channel (a maximal group of adjacent-lane, overlapping runs) so lines cross their
// neighbours' entry/exit connectors as little as possible — bundles then run
// parallel and nested, like the reference's lane groups.

interface ChannelEntry {
  s: LaneSeg;
  coord: number;
}

// Connectors of a channel run: where (along the run axis) its neighbours attach,
// which side of the channel they extend toward, and how far.
function connectorsOf(s: LaneSeg, vertical: boolean): { at: number; dir: 1 | -1; to: number }[] {
  const out: { at: number; dir: 1 | -1; to: number }[] = [];
  const { pts, i } = s;
  if (i > 0) {
    const far = pts[i - 1]!;
    const end = pts[i]!;
    const d = vertical ? far.x - end.x : far.y - end.y;
    if (Math.abs(d) > 0.5) out.push({ at: vertical ? end.y : end.x, dir: d > 0 ? 1 : -1, to: vertical ? far.x : far.y });
  }
  if (i + 2 < pts.length) {
    const far = pts[i + 2]!;
    const end = pts[i + 1]!;
    const d = vertical ? far.x - end.x : far.y - end.y;
    if (Math.abs(d) > 0.5) out.push({ at: vertical ? end.y : end.x, dir: d > 0 ? 1 : -1, to: vertical ? far.x : far.y });
  }
  return out;
}

// Crossings if A takes the lesser-coordinate lane and B the greater: A's connectors
// toward greater coords cross B when they attach strictly inside B's span (and
// reach past it); symmetrically for B's connectors toward lesser coords over A.
function crossingsFor(A: ChannelEntry, B: ChannelEntry, vertical: boolean): number {
  let c = 0;
  for (const k of connectorsOf(A.s, vertical)) {
    if (k.dir > 0 && k.to > Math.max(A.coord, B.coord) && k.at > B.s.lo + 0.5 && k.at < B.s.hi - 0.5) c++;
  }
  for (const k of connectorsOf(B.s, vertical)) {
    if (k.dir < 0 && k.to < Math.min(A.coord, B.coord) && k.at > A.s.lo + 0.5 && k.at < A.s.hi - 0.5) c++;
  }
  return c;
}

function orderChannels(model: Model, cards: Card[], entries: ChannelEntry[], vertical: boolean): void {
  const n = entries.length;
  if (n < 2) return;
  // Union runs into channels: adjacent lanes + overlapping intervals.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (Math.abs(a.coord - b.coord) <= LANE_STEP + 0.5 && a.s.lo <= b.s.hi + 1 && b.s.lo <= a.s.hi + 1)
        parent[find(i)] = find(j);
    }
  }
  const channels = new Map<number, ChannelEntry[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let arr = channels.get(r);
    if (!arr) channels.set(r, (arr = []));
    arr.push(entries[i]!);
  }

  for (const ch of channels.values()) {
    const perm = ch.filter((e) => !e.s.fixed);
    if (perm.length < 2) continue;
    const inChannel = new Set(ch);
    const coords = perm.map((e) => e.coord).sort((a, b) => a - b);
    const sorted = [...perm].sort(
      (a, b) => crossingsFor(a, b, vertical) - crossingsFor(b, a, vertical) || a.coord - b.coord,
    );
    // Feasibility: every reassigned run must still clear cards and closed groups,
    // AND keep global separation — a swapped run has a different interval than the
    // lane's previous occupant, so runs outside the channel can newly collide.
    const moves: { e: ChannelEntry; d: number; target: number }[] = [];
    let ok = true;
    sorted.forEach((e, idx) => {
      const target = coords[idx]!;
      const d = target - e.coord;
      if (Math.abs(d) > 0.01) {
        if (shiftBlocked(model, cards, e.s, d, vertical)) ok = false;
        else if (
          entries.some(
            (o) =>
              !inChannel.has(o) &&
              Math.abs(o.coord - target) < MIN_SEP &&
              o.s.lo <= e.s.hi + 1 &&
              e.s.lo <= o.s.hi + 1,
          )
        )
          ok = false;
        moves.push({ e, d, target });
      }
    });
    // The channel's coord multiset may contain (near-)duplicates — lanes legally
    // shared by interval-DISJOINT runs. A positional reassignment must never hand
    // those coords to runs that DO overlap, or the allocator's separation is undone.
    if (ok) {
      for (let a = 0; a < sorted.length && ok; a++) {
        for (let b = a + 1; b < sorted.length; b++) {
          const ea = sorted[a]!;
          const eb = sorted[b]!;
          if (Math.abs(coords[a]! - coords[b]!) >= MIN_SEP) continue;
          if (ea.s.lo <= eb.s.hi + 1 && eb.s.lo <= ea.s.hi + 1) {
            ok = false;
            break;
          }
        }
      }
    }
    if (!ok) continue; // keep the allocation order rather than break a guard
    for (const { e, d, target } of moves) {
      applyShift(e.s, d, vertical);
      e.coord = target;
    }
  }
}

// ---- Port slot ordering ----------------------------------------------------------
// Pin fan slots are assigned BEFORE routing (by the other endpoint's y), but the
// routed geometry decides which lane each line actually takes — when the two orders
// disagree, bundle-mates are forced to cross right at the pin. After routing and
// lane assignment, re-derive each pin's slot order from the final geometry:
// up-turning lines take the upper slots (nearest turn first), down-turning lines
// the lower slots (nearest turn last) — so no stub crosses a bundle-mate's vertical.

interface PortEnd {
  rel: Relationship;
  which: 'src' | 'tgt';
  pts: Point[];
  slot: number;
}

function reorderPortSlots(model: Model, hEntries: ChannelEntry[]): void {
  const groups = new Map<string, PortEnd[]>();
  for (const rel of model.relationships) {
    const pts = rel._route;
    if (!pts || rel.source === rel.target) continue;
    const { s, t } = edgeSides(model, rel);
    const add = (key: string, end: PortEnd) => {
      let arr = groups.get(key);
      if (!arr) groups.set(key, (arr = []));
      arr.push(end);
    };
    add(rel.source + '|' + rel.sourceField + '|' + s, { rel, which: 'src', pts, slot: rel._srcSlot ?? 0 });
    add(rel.target + '|' + rel.targetField + '|' + t, { rel, which: 'tgt', pts, slot: rel._tgtSlot ?? 0 });
  }

  // Identify each horizontal stub entry by its edge end, so the clash veto can
  // resolve final positions when this port's own stubs are among the movers.
  const endKeyOf = (e: ChannelEntry) => (e.s.fixed ? e.s.rel.id + '|' + (e.s.i === 0 ? 'src' : 'tgt') : null);

  for (const ends of groups.values()) {
    if (ends.length < 2) continue;
    // Every end must have the standard shape (horizontal stub, then a vertical)
    // long enough to absorb the slot delta; otherwise leave this port alone.
    const info = ends.map((e) => {
      const pts = e.which === 'src' ? e.pts : [...e.pts].reverse();
      if (pts.length < 4) return null;
      const p0 = pts[0]!;
      const p1 = pts[1]!;
      const p2 = pts[2]!;
      if (Math.abs(p1.y - p0.y) > 0.5 || Math.abs(p2.x - p1.x) > 0.5) return null;
      return { e, up: p2.y < p1.y, dist: Math.abs(p1.x - p0.x), vlen: Math.abs(p2.y - p1.y) };
    });
    if (info.some((x) => x == null)) continue;
    const list = info as { e: PortEnd; up: boolean; dist: number; vlen: number }[];

    // Top-to-bottom: ups by turn nearness, then downs by turn farness.
    list.sort((a, b) => (a.up !== b.up ? (a.up ? -1 : 1) : a.up ? a.dist - b.dist : b.dist - a.dist));
    const offsets = ends.map((e) => e.slot).sort((a, b) => a - b);

    // The vertical after each stub must stay taller than the slot shift.
    if (!list.every((x, idx) => x.vlen > Math.abs(offsets[idx]! - x.e.slot) + 4)) continue;

    // Clash veto: a swapped stub travels on a new y with its OWN x-extent — it must
    // not land within visual range of any other horizontal run's final position.
    const newY = new Map<string, number>(); // relId|which → stub y after the swap
    list.forEach((x, idx) => {
      const d = offsets[idx]! - x.e.slot;
      if (Math.abs(d) < 0.01) return;
      const pts = x.e.pts;
      const y = (x.e.which === 'src' ? pts[0]!.y : pts[pts.length - 1]!.y) + d;
      newY.set(x.e.rel.id + '|' + x.e.which, y);
    });
    if (newY.size === 0) continue;
    let clash = false;
    for (const x of list) {
      const key = x.e.rel.id + '|' + x.e.which;
      const ny = newY.get(key);
      if (ny == null) continue;
      const pts = x.e.pts;
      const [q0, q1] = x.e.which === 'src' ? [pts[0]!, pts[1]!] : [pts[pts.length - 1]!, pts[pts.length - 2]!];
      const lo = Math.min(q0.x, q1.x);
      const hi = Math.max(q0.x, q1.x);
      for (const o of hEntries) {
        const ok = endKeyOf(o);
        if (ok === key) continue;
        const oy = ok != null && newY.has(ok) ? newY.get(ok)! : o.coord;
        if (Math.abs(oy - ny) < 6 && o.s.lo < hi - 4 && lo < o.s.hi - 4) {
          clash = true;
          break;
        }
      }
      if (clash) break;
    }
    if (clash) continue;

    list.forEach((x, idx) => {
      const slot = offsets[idx]!;
      const d = slot - x.e.slot;
      if (Math.abs(d) < 0.01) return;
      if (x.e.which === 'src') {
        x.e.rel._srcSlot = slot;
        x.e.pts[0]!.y += d;
        x.e.pts[1]!.y += d;
      } else {
        x.e.rel._tgtSlot = slot;
        x.e.pts[x.e.pts.length - 1]!.y += d;
        x.e.pts[x.e.pts.length - 2]!.y += d;
      }
    });
  }
}

function shiftBlocked(model: Model, cards: Card[], s: LaneSeg, d: number, vertical: boolean): boolean {
  const a = s.pts[s.i]!;
  const b = s.pts[s.i + 1]!;
  const nx1 = vertical ? a.x + d : a.x;
  const ny1 = vertical ? a.y : a.y + d;
  const nx2 = vertical ? b.x + d : b.x;
  const ny2 = vertical ? b.y : b.y + d;
  return segHitsCard(nx1, ny1, nx2, ny2, cards) || segHitsGroup(model, s.rel, nx1, ny1, nx2, ny2);
}

function rectHit(x1: number, y1: number, x2: number, y2: number, x: number, y: number, w: number, h: number): boolean {
  const pad = 3;
  const rx1 = x - pad;
  const ry1 = y - pad;
  const rx2 = x + w + pad;
  const ry2 = y + h + pad;
  if (Math.abs(y1 - y2) < 0.5) return y1 > ry1 && y1 < ry2 && Math.min(x1, x2) < rx2 && Math.max(x1, x2) > rx1;
  return x1 > rx1 && x1 < rx2 && Math.min(y1, y2) < ry2 && Math.max(y1, y2) > ry1;
}

function segHitsCard(x1: number, y1: number, x2: number, y2: number, cards: Card[]): boolean {
  for (const c of cards) if (rectHit(x1, y1, x2, y2, c.x, c.y, c.w, c.h)) return true;
  return false;
}

function segHitsGroup(model: Model, rel: Relationship, x1: number, y1: number, x2: number, y2: number): boolean {
  const A = model.entityById.get(rel.source)!;
  const B = model.entityById.get(rel.target)!;
  const open = new Set<string>([A.group, zoneIdOf(model, A.group), B.group, zoneIdOf(model, B.group)]);
  for (const b of model._groupBounds) {
    if (open.has(b.id)) continue;
    if (rectHit(x1, y1, x2, y2, b.x, b.y, b.w, b.h)) return true;
  }
  return false;
}

function routePolyline(model: Model, rel: Relationship, cards: Card[]): Point[] {
  const { p1, p2, s, t } = edgeEndpoints(model, rel);
  const a1: Point = { x: p1.x + (s === 'R' ? STUB : -STUB), y: p1.y };
  const b1: Point = { x: p2.x + (t === 'R' ? STUB : -STUB), y: p2.y };

  // Groups holding an endpoint stay permeable (the line has to reach inside them);
  // every other zone/subgroup box is an obstacle, so lines route around groups too.
  const A = model.entityById.get(rel.source)!;
  const B = model.entityById.get(rel.target)!;
  const openGroups = new Set<string>([A.group, zoneIdOf(model, A.group), B.group, zoneIdOf(model, B.group)]);
  const groupObs: Card[] = model._groupBounds
    .filter((b) => !openGroups.has(b.id))
    .map((b) => ({ id: 'grp:' + b.id, x: b.x, y: b.y, w: b.w, h: b.h }));

  const obstacles = [...cards.filter((c) => c.id !== rel.source && c.id !== rel.target), ...groupObs];

  const xset = new Set<number>([a1.x, b1.x]);
  const yset = new Set<number>([a1.y, b1.y]);
  for (const c of cards) {
    xset.add(c.x - MARG);
    xset.add(c.x + c.w + MARG);
    yset.add(c.y - MARG);
    yset.add(c.y + c.h + MARG);
  }
  for (const b of groupObs) {
    xset.add(b.x - MARG);
    xset.add(b.x + b.w + MARG);
    yset.add(b.y - MARG);
    yset.add(b.y + b.h + MARG);
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
  return simplifyPolyline([p1, ...grid, p2]);
}

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
