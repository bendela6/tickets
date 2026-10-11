import type { LifecycleData } from './schema';

// Where everything in a lifecycle diagram sits, in pixels: the states in
// columns, the wires between them, the event names on the wires, and the mark
// leading into the initial state. Pure arithmetic, so it is tested without a
// DOM and the component only paints what it is handed.

type Machine = Pick<LifecycleData, 'initial' | 'states'>;

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How a wire runs: on to a later column, back to an earlier one, to another
 * state in its own column, or round to the state it left.
 */
export type Route = 'forward' | 'back' | 'column' | 'self';

export interface Wire {
  from: string;
  to: string;
  event: string;
  route: Route;
  /** The curve, stopping where the arrowhead starts. */
  path: string;
  /** The arrowhead. */
  arrow: string;
  /** Where the arrowhead's point touches the target's edge. */
  tip: Point;
  /** The box the event's name sits in, on the wire. */
  label: Box;
}

export interface Layout {
  /** Each state's top left corner. */
  pos: Record<string, Point>;
  nodeWidth: number;
  /** From one column's left edge to the next one's. */
  columnWidth: number;
  /** Declared states nothing leads to from `initial`, pinned to the first column. */
  unreachable: string[];
  wires: Wire[];
  /** The mark leading into the initial state: a dot, then a stub and its arrowhead. */
  entry?: { dot: Point; path: string; arrow: string };
  /** All of it, entry mark and labels included; it may start left of or above 0. */
  bounds: Box;
}

export const NODE_HEIGHT = 36;
export const LABEL_HEIGHT = 16;
/** The entry mark's dot. */
export const ENTRY_RADIUS = 4;

const NODE_MIN_WIDTH = 104;
const NODE_PAD = 14;
/** The sizes names are drawn at, in the app's mono font: a state's, and an event's. */
const STATE_SIZE = 12;
const EVENT_SIZE = 11;
const LABEL_PAD = 5;
/** The least room between columns, and the room around the longest name there. */
const COLUMN_GAP = 72;
const COLUMN_GAP_PAD = 40;
const ROW_GAP = 40;
/** How far past its row a loop (under it) or an arc (over it) reaches in its first lane, and each lane after. */
const DIP = 24;
const LANE = 22;
const ARROW_LENGTH = 7;
const ARROW_HALF = 3.5;
const ENTRY_LENGTH = 26;
/** How far a state's box reaches past itself: the double rule a final state wears. */
const NODE_HALO = 4;
const LABEL_HALO = 2;
/** Where along its wire a label may sit, best first. */
const ALONG = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
/** Which wires choose their label's spot first: the ones with the fewest spots to choose from. */
const PLACING_ORDER: readonly Route[] = ['self', 'back', 'column', 'forward'];

const round = (n: number) => Math.round(n * 10) / 10;
const pt = ({ x, y }: Point) => `${round(x)} ${round(y)}`;

/** A point on a cubic Bézier, `t` from 0 to 1. */
function bezier([p0, p1, p2, p3]: readonly [Point, Point, Point, Point], t: number): Point {
  const s = 1 - t;
  const a = s * s * s;
  const b = 3 * s * s * t;
  const c = 3 * s * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** A filled arrowhead with its point at `tip`, coming from `from`; and where its base sits. */
function arrowhead(from: Point, tip: Point): { base: Point; arrow: string } {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const u = { x: dx / length, y: dy / length };
  const base = { x: tip.x - u.x * ARROW_LENGTH, y: tip.y - u.y * ARROW_LENGTH };
  const left = { x: base.x - u.y * ARROW_HALF, y: base.y + u.x * ARROW_HALF };
  const right = { x: base.x + u.y * ARROW_HALF, y: base.y - u.x * ARROW_HALF };
  return { base, arrow: `M${pt(tip)} L${pt(left)} L${pt(right)} Z` };
}

function overlaps(a: Box, b: Box, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}

/** How wide a run of text is drawn at a size, in pixels, in the font the names are drawn in. */
export type MeasureText = (text: string, size: number) => number;

/**
 * A name's width with no font to ask: a monospace font advances about 0.6em
 * (IBM Plex Mono, JetBrains Mono, Menlo, Courier), so its length says it. What
 * the diagram is laid out by before it is in a page, and in a test.
 */
export const monoAdvance: MeasureText = (text, size) => text.length * size * 0.6;

/**
 * Columns by shortest path from `initial` (a breadth-first walk), so the
 * diagram reads left to right in the order things happen. A state nothing
 * reaches is pinned to column 0 and reported, because the schema already
 * refuses a transition to an undeclared state but says nothing about a
 * declared one that is never entered. States share a column top to bottom in
 * the order they are declared.
 *
 * Wires: on to a later column, a curve from the right edge to the left one; to
 * a state in the same column, a bow out to the right; back to an earlier
 * column, an arc over the row when both sit in one row (clear of the forward
 * wires, which fan downwards), or a curve between the rows when they don't;
 * and to itself, a loop under the state. Arcs over one row, and loops under
 * one, take a lane each, and the gap between rows grows to hold them. Each
 * event's name then takes the first spot along its wire clear of every state
 * and every name placed before it.
 *
 * `measure` says how wide a name is drawn: the app's own mono font, measured,
 * or `monoAdvance` when there is none to measure.
 */
export function layoutStates(model: Machine, measure: MeasureText = monoAdvance): Layout {
  const { states, initial } = model;
  const labelWidth = (event: string) => Math.ceil(measure(event, EVENT_SIZE) + 2 * LABEL_PAD);
  const names = Object.keys(states);
  // Own keys only: a lookup through the prototype would count `toString` as a
  // state. For the same reason everything keyed by state name below is a Map.
  const declared = (name: string) => Object.hasOwn(states, name);

  const depth = new Map<string, number>();
  if (declared(initial)) {
    depth.set(initial, 0);
  }
  const queue = declared(initial) ? [initial] : [];
  // An array's iterator reads its length each step, so the walk takes in what it pushes.
  for (const current of queue) {
    for (const to of Object.values(states[current] ?? {})) {
      if (!declared(to) || depth.has(to)) {
        continue;
      }
      depth.set(to, (depth.get(current) ?? 0) + 1);
      queue.push(to);
    }
  }
  const unreachable = names.filter((name) => !depth.has(name));

  const cell = new Map<string, { column: number; row: number }>();
  const filled: number[] = [];
  for (const name of names) {
    const column = depth.get(name) ?? 0;
    const row = filled[column] ?? 0;
    filled[column] = row + 1;
    cell.set(name, { column, row });
  }
  const at = (name: string) => cell.get(name) ?? { column: 0, row: 0 };

  const transitions: { from: string; to: string; event: string; route: Route }[] = [];
  for (const [from, events] of Object.entries(states)) {
    for (const [event, to] of Object.entries(events)) {
      if (!declared(to)) {
        continue;
      }
      const a = at(from);
      const b = at(to);
      const route: Route =
        to === from
          ? 'self'
          : b.column > a.column
            ? 'forward'
            : b.column < a.column
              ? 'back'
              : 'column';
      transitions.push({ from, to, event, route });
    }
  }

  // A state is as wide as the longest name; a gap as wide as the longest name
  // drawn in it, which only a forward wire's is.
  const widestName = Math.max(0, ...names.map((name) => measure(name, STATE_SIZE)));
  const nodeWidth = Math.max(NODE_MIN_WIDTH, Math.ceil(widestName + 2 * NODE_PAD));
  const widestForward = Math.max(
    0,
    ...transitions.filter((t) => t.route === 'forward').map((t) => labelWidth(t.event)),
  );
  const columnWidth = nodeWidth + Math.max(COLUMN_GAP, widestForward + COLUMN_GAP_PAD);

  // A loop runs under its state's row and an arc back along a row over it;
  // each takes the next lane on its side of its row.
  const isArc = (t: (typeof transitions)[number]) => {
    return t.route === 'back' && at(t.from).row === at(t.to).row;
  };
  const above: number[] = [];
  const below: number[] = [];
  const laneOf = new Map<(typeof transitions)[number], number>();
  for (const t of transitions) {
    const lanes = t.route === 'self' ? below : isArc(t) ? above : null;
    if (lanes) {
      const row = at(t.from).row;
      laneOf.set(t, lanes[row] ?? 0);
      lanes[row] = (lanes[row] ?? 0) + 1;
    }
  }
  // What a row's lanes need beside it: the furthest curve's furthest point, its label, and a margin.
  const band = (count = 0) => {
    return count > 0 ? 0.75 * (DIP + (count - 1) * LANE) + LABEL_HEIGHT / 2 + 10 : 0;
  };
  const rows = Math.max(0, ...filled);
  const rowTop: number[] = [];
  for (let row = 0, y = 0; row < rows; row++) {
    rowTop.push(y);
    y += NODE_HEIGHT + Math.max(ROW_GAP, band(below[row]) + band(above[row + 1]));
  }

  const pos = new Map<string, Point>();
  for (const name of names) {
    const { column, row } = at(name);
    pos.set(name, { x: column * columnWidth, y: rowTop[row] ?? 0 });
  }
  const box = (name: string): Box => {
    const { x, y } = pos.get(name) ?? { x: 0, y: 0 };
    return { x, y, width: nodeWidth, height: NODE_HEIGHT };
  };

  // Wires meeting one side of a state spread along it rather than share a
  // point, in the order of the states at their other ends, top to bottom, so
  // a fan of them doesn't cross itself. Forward wires leave by the right side
  // and arrive by the left; a wire within a column leaves and arrives by the right.
  type Transition = (typeof transitions)[number];
  type End = 'start' | 'tip';
  const sides = new Map<
    string,
    { state: string; list: { t: Transition; end: End; other: string }[] }
  >();
  const attach = (
    side: 'left' | 'right',
    state: string,
    t: Transition,
    end: End,
    other: string,
  ) => {
    const key = `${side} ${state}`;
    const entry = sides.get(key) ?? { state, list: [] };
    entry.list.push({ t, end, other });
    sides.set(key, entry);
  };
  for (const t of transitions) {
    if (t.route === 'forward') {
      attach('right', t.from, t, 'start', t.to);
      attach('left', t.to, t, 'tip', t.from);
    } else if (t.route === 'column') {
      attach('right', t.from, t, 'start', t.to);
      attach('right', t.to, t, 'tip', t.from);
    }
  }
  const port = new Map<Transition, Partial<Record<End, number>>>();
  for (const { state, list } of sides.values()) {
    const { y } = box(state);
    const sorted = [...list].sort((a, b) => box(a.other).y - box(b.other).y);
    sorted.forEach(({ t, end }, index) => {
      port.set(t, { ...port.get(t), [end]: y + (NODE_HEIGHT * (index + 1)) / (sorted.length + 1) });
    });
  }

  const curves = transitions.map((t) => {
    const a = box(t.from);
    const b = box(t.to);
    const middle = (n: Box) => n.y + NODE_HEIGHT / 2;
    const bottom = (n: Box) => n.y + NODE_HEIGHT;
    const out = port.get(t)?.start ?? middle(a);
    const into = port.get(t)?.tip ?? middle(b);
    let p0: Point;
    let p1: Point;
    let p2: Point;
    let tip: Point;
    if (t.route === 'forward') {
      p0 = { x: a.x + nodeWidth, y: out };
      tip = { x: b.x, y: into };
      const c = (p0.x + tip.x) / 2;
      p1 = { x: c, y: p0.y };
      p2 = { x: c, y: tip.y };
    } else if (t.route === 'column') {
      // Bow out far enough that the label at the bow's furthest point clears the column.
      const reach = Math.max(24, labelWidth(t.event) / 2 + 10) / 0.75;
      p0 = { x: a.x + nodeWidth, y: out };
      tip = { x: b.x + nodeWidth, y: into };
      p1 = { x: p0.x + reach, y: p0.y };
      p2 = { x: tip.x + reach, y: tip.y };
    } else if (t.route === 'self') {
      const centre = a.x + nodeWidth / 2;
      const below = bottom(a) + DIP + (laneOf.get(t) ?? 0) * LANE;
      p0 = { x: centre - 14, y: bottom(a) };
      tip = { x: centre + 14, y: bottom(a) };
      p1 = { x: centre - 36, y: below };
      p2 = { x: centre + 36, y: below };
    } else if (isArc(t)) {
      // Back along one row: out of the top, over the row, into the top.
      const over = a.y - DIP - (laneOf.get(t) ?? 0) * LANE;
      p0 = { x: a.x + nodeWidth * 0.3, y: a.y };
      tip = { x: b.x + nodeWidth * 0.7, y: b.y };
      p1 = { x: p0.x, y: over };
      p2 = { x: tip.x, y: over };
    } else if (at(t.to).row > at(t.from).row) {
      // Back and down: out of the bottom, into the top.
      p0 = { x: a.x + nodeWidth * 0.3, y: bottom(a) };
      tip = { x: b.x + nodeWidth * 0.7, y: b.y };
      const half = (tip.y - p0.y) / 2;
      p1 = { x: p0.x, y: p0.y + half };
      p2 = { x: tip.x, y: tip.y - half };
    } else {
      // Back and up: out of the top, into the bottom.
      p0 = { x: a.x + nodeWidth * 0.3, y: a.y };
      tip = { x: b.x + nodeWidth * 0.7, y: bottom(b) };
      const half = (p0.y - tip.y) / 2;
      p1 = { x: p0.x, y: p0.y - half };
      p2 = { x: tip.x, y: tip.y + half };
    }
    const { base, arrow } = arrowhead(p2, tip);
    const points = [p0, p1, p2, base] as const;
    return {
      ...t,
      points,
      tip,
      arrow,
      path: `M${pt(p0)} C${pt(p1)} ${pt(p2)} ${pt(base)}`,
    };
  });

  const obstacles = names.map(box);
  const placed: Box[] = [];
  const labels = new Map<(typeof curves)[number], Box>();
  const byOrder = [...curves].sort((a, b) => {
    return PLACING_ORDER.indexOf(a.route) - PLACING_ORDER.indexOf(b.route);
  });
  // Greedy, and good enough at the size a page holds: each label takes the
  // first spot along its wire that touches no state and no label placed before
  // it, or the middle of its wire if every spot is taken.
  for (const curve of byOrder) {
    const width = labelWidth(curve.event);
    const boxAt = (t: number): Box => {
      const centre = bezier(curve.points, t);
      return {
        x: round(centre.x - width / 2),
        y: round(centre.y - LABEL_HEIGHT / 2),
        width,
        height: LABEL_HEIGHT,
      };
    };
    const spots = curve.route === 'self' ? [0.5] : ALONG;
    const clear = spots.map(boxAt).find((spot) => {
      return (
        !obstacles.some((node) => overlaps(spot, node, NODE_HALO)) &&
        !placed.some((other) => overlaps(spot, other, LABEL_HALO))
      );
    });
    const label = clear ?? boxAt(0.5);
    placed.push(label);
    labels.set(curve, label);
  }

  const wires: Wire[] = curves.map((curve) => {
    const { from, to, event, route, path, arrow, tip } = curve;
    const label = labels.get(curve) ?? { x: 0, y: 0, width: 0, height: 0 };
    return { from, to, event, route, path, arrow, tip, label };
  });

  let entry: Layout['entry'];
  const start = pos.get(initial);
  if (start) {
    const tip = { x: start.x, y: start.y + NODE_HEIGHT / 2 };
    const dot = { x: tip.x - ENTRY_LENGTH, y: tip.y };
    const { base, arrow } = arrowhead(dot, tip);
    entry = { dot, path: `M${pt({ x: dot.x + ENTRY_RADIUS, y: dot.y })} L${pt(base)}`, arrow };
  }

  // The drawing's extent: every state with its halo, every label, every curve
  // (sampled, since a curve stays well inside its control points), the entry mark.
  const extent: Box[] = [
    ...obstacles.map((n) => {
      return {
        x: n.x - NODE_HALO,
        y: n.y - NODE_HALO,
        width: n.width + 2 * NODE_HALO,
        height: n.height + 2 * NODE_HALO,
      };
    }),
    ...placed,
    ...curves.flatMap((curve) => {
      return Array.from({ length: 11 }, (_, i) => {
        return {
          ...bezier(curve.points, i / 10),
          width: 0,
          height: 0,
        };
      });
    }),
  ];
  if (entry) {
    extent.push({
      x: entry.dot.x - ENTRY_RADIUS,
      y: entry.dot.y - ENTRY_RADIUS,
      width: 2 * ENTRY_RADIUS,
      height: 2 * ENTRY_RADIUS,
    });
  }
  const left = Math.min(0, ...extent.map((b) => b.x));
  const top = Math.min(0, ...extent.map((b) => b.y));
  const right = Math.max(0, ...extent.map((b) => b.x + b.width));
  const lowest = Math.max(0, ...extent.map((b) => b.y + b.height));

  return {
    pos: Object.fromEntries(pos),
    nodeWidth,
    columnWidth,
    unreachable,
    wires,
    entry,
    bounds: {
      x: Math.floor(left),
      y: Math.floor(top),
      width: Math.ceil(right) - Math.floor(left),
      height: Math.ceil(lowest) - Math.floor(top),
    },
  };
}
