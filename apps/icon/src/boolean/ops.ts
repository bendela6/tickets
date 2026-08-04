import { arcPath, centreOf, flattenPath, pointInPolygon } from '../doc/geometry';
import {
  chainTo,
  composePlacement,
  everyShape,
  findNode,
  frameOf,
  isGroup,
  segmentsThrough,
  spinAbout,
  withoutNodes,
  type Placement,
} from '../doc/tree';
import type { Geometry, IconNode, IconObject, PathSegment, Point } from '../doc/types';
import { pathData } from '../render/svg';

/**
 * The four operations, and everything about them that is not wasm.
 *
 * The split is the whole design of this feature: what a selection may be
 * combined into, which operand is which, where the answer lands and what it is
 * painted with are all decided here, in pure functions over the document — and
 * `engine.ts` is handed nothing but `d` strings. That is what lets the reducer,
 * the rail and their tests state every rule without a WebAssembly module being
 * anywhere near them.
 */

export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

/** The four, in the order the rail offers them, with what each button says. */
export const BOOLEAN_OPS: readonly { readonly op: BooleanOp; readonly label: string }[] = [
  { op: 'union', label: 'Union' },
  { op: 'subtract', label: 'Subtract' },
  { op: 'intersect', label: 'Intersect' },
  { op: 'exclude', label: 'Exclude' },
];

/**
 * The engine, stated as one function: outlines in, one outline out.
 *
 * A `d` string is the narrowest thing both sides already understand — the
 * renderer writes them and the importer reads them — so the boundary needs no
 * type of its own and no library type escapes through it. Asynchronous because
 * the implementation has a WebAssembly module to fetch, and that is the only
 * thing about the implementation this side of the boundary knows.
 */
export type BooleanEngine = (op: BooleanOp, paths: readonly string[]) => Promise<string>;

/**
 * Why the operations cannot run on this selection, or null when they can.
 *
 * One statement of the rule for the rail and the reducer both, so a button that
 * is offered can always be honoured and one that is refused says the same thing
 * the reducer would have done silently.
 *
 * **A group is refused rather than flattened.** Combining one would mean
 * dissolving it first — throwing away an arrangement somebody built and a
 * transform they can still edit — and that is what ⇧⌘G is for. Doing it as a
 * side effect of pressing Union would be a second, invisible ungroup.
 */
export function combineRefusal(nodes: readonly IconNode[]): string | null {
  if (nodes.some(isGroup)) return 'a group is several shapes — ⇧⌘G takes one apart first';
  if (nodes.length < 2) return 'two shapes at least — there is nothing to combine one with';
  return null;
}

/**
 * A geometry as path commands: every kind written the one way an outline can be
 * read.
 *
 * Exact rather than flattened. `flattenPath` exists for the questions a run of
 * straight lines can answer — a bounding box, a hit test — and this is not one
 * of them: the engine is being asked where two outlines actually cross, so it
 * is given the arcs and the curves themselves. A circle is two arcs and a
 * curved corner is one, which is what `<circle>` and `<rect rx>` mean.
 *
 * A run that does not close stays open. SVG fills an open subpath as though it
 * closed, so the engine sees what a renderer would see, and nothing here has to
 * invent an area a line does not have.
 */
export function pathOf(geometry: Geometry): PathSegment[] {
  switch (geometry.kind) {
    case 'rect': {
      const { x, y, w, h } = geometry;
      // SVG grows no corner past half the side it sits on, so neither does this
      // — a wider one would make the two corners of a side overlap.
      const radius = Math.min(Math.max(0, geometry.radius), w / 2, h / 2);
      if (radius <= 0) {
        return [
          { c: 'M', x, y },
          { c: 'L', x: x + w, y },
          { c: 'L', x: x + w, y: y + h },
          { c: 'L', x, y: y + h },
          { c: 'Z' },
        ];
      }
      const corner = (toX: number, toY: number): PathSegment => ({
        c: 'A',
        rx: radius,
        ry: radius,
        rotation: 0,
        large: false,
        sweep: true,
        x: toX,
        y: toY,
      });
      return [
        { c: 'M', x: x + radius, y },
        { c: 'L', x: x + w - radius, y },
        corner(x + w, y + radius),
        { c: 'L', x: x + w, y: y + h - radius },
        corner(x + w - radius, y + h),
        { c: 'L', x: x + radius, y: y + h },
        corner(x, y + h - radius),
        { c: 'L', x, y: y + radius },
        corner(x + radius, y),
        { c: 'Z' },
      ];
    }
    case 'circle':
      // The whole-turn case of the generator the arc preset already uses, which
      // is where the reason a full circle takes two arcs rather than one is
      // written down.
      return arcPath({
        cx: geometry.cx,
        cy: geometry.cy,
        r: geometry.r,
        inner: 0,
        start: 0,
        sweep: 360,
      });
    case 'ellipse': {
      const { x, y, w, h } = geometry;
      const rx = w / 2;
      const ry = h / 2;
      const middle = y + ry;
      const half = (toX: number): PathSegment => ({
        c: 'A',
        rx,
        ry,
        rotation: 0,
        large: false,
        sweep: true,
        x: toX,
        y: middle,
      });
      // Two half turns for the reason a circle takes two: an arc is stated by
      // where it ends, and one that ends where it began has no length.
      return [{ c: 'M', x, y: middle }, half(x + w), half(x), { c: 'Z' }];
    }
    case 'line':
      return [
        { c: 'M', x: geometry.x1, y: geometry.y1 },
        { c: 'L', x: geometry.x2, y: geometry.y2 },
      ];
    case 'polyline':
    case 'polygon': {
      const [first, ...rest] = geometry.points;
      if (first === undefined) return [];
      const run: PathSegment[] = [
        { c: 'M', x: first.x, y: first.y },
        ...rest.map((point): PathSegment => ({ c: 'L', x: point.x, y: point.y })),
      ];
      return geometry.kind === 'polygon' ? [...run, { c: 'Z' }] : run;
    }
    case 'path':
      return geometry.segments.slice();
  }
}

/** One operand: a shape, and the frame its own coordinates are stated in. */
export interface CombineOperand {
  shape: IconObject;
  frame: Placement;
}

/**
 * One operand's outline in artboard units.
 *
 * Two frames reach a shape and both are folded into one placement before a
 * single point map is applied: the turn the shape carries itself, which is
 * about the centre of its own box, and the frame of whatever groups it sits
 * inside. Composing them first rather than applying them one after the other is
 * what keeps the answer exact — a similarity composed with a similarity is a
 * similarity, so an arc stays an arc and a cubic stays a cubic, and nothing is
 * approximated on the way out.
 */
export function operandPath(operand: CombineOperand): string {
  const { shape, frame } = operand;
  const world = composePlacement(frame, spinAbout(centreOf(shape), shape.rotation));
  return pathData(segmentsThrough(pathOf(shape.geometry), world));
}

/* ── winding ────────────────────────────────────────────────────────────── */

/**
 * How much area a run of points encloses, and which way round it goes.
 *
 * The sign is the whole point; the magnitude is only ever compared against
 * zero. Which sign means clockwise depends on the y axis pointing down, and
 * nothing below cares — a hole is stated by turning the *opposite* way to what
 * holds it, and opposite is a relation rather than a direction.
 */
function signedArea(run: readonly Point[]): number {
  let sum = 0;
  for (let i = 0, j = run.length - 1; i < run.length; j = i++) {
    const a = run[i];
    const b = run[j];
    if (!a || !b) continue;
    sum += (b.x - a.x) * (b.y + a.y);
  }
  return sum / 2;
}

/** The commands split at every `M`: one list per contour, in the order written. */
function contoursOf(segments: readonly PathSegment[]): PathSegment[][] {
  const contours: PathSegment[][] = [];
  let current: PathSegment[] | null = null;
  for (const segment of segments) {
    if (segment.c === 'M' || current === null) {
      current = [];
      contours.push(current);
    }
    current.push(segment);
  }
  return contours;
}

/**
 * One contour drawn the other way round, along exactly the same curve.
 *
 * Each command is turned back to front rather than approximated: a cubic's two
 * controls swap, a quadratic's single control stays where it is, and an arc
 * keeps its radii and its axis and flips only the direction it sweeps. What
 * comes out is the same set of points in the opposite order, which is what
 * makes this safe to do to a shape somebody can see.
 */
function reversedContour(commands: readonly PathSegment[]): PathSegment[] {
  const opening = commands[0];
  if (opening === undefined || opening.c === 'Z') return commands.slice();

  const points: Point[] = [{ x: opening.x, y: opening.y }];
  const steps: PathSegment[] = [];
  let closed = false;
  for (const command of commands.slice(1)) {
    if (command.c === 'Z') {
      closed = true;
      continue;
    }
    steps.push(command);
    points.push({ x: command.x, y: command.y });
  }

  const last = points[points.length - 1];
  if (last === undefined) return commands.slice();
  const reversed: PathSegment[] = [{ c: 'M', x: last.x, y: last.y }];
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    // Where the step began is where its reverse has to end.
    const to = points[i];
    if (step === undefined || to === undefined) continue;
    switch (step.c) {
      case 'Q':
        reversed.push({ c: 'Q', x1: step.x1, y1: step.y1, x: to.x, y: to.y });
        break;
      case 'C':
        reversed.push({
          c: 'C',
          x1: step.x2,
          y1: step.y2,
          x2: step.x1,
          y2: step.y1,
          x: to.x,
          y: to.y,
        });
        break;
      case 'A':
        reversed.push({ ...step, sweep: !step.sweep, x: to.x, y: to.y });
        break;
      default:
        reversed.push({ c: 'L', x: to.x, y: to.y });
    }
  }
  if (closed) reversed.push({ c: 'Z' });
  return reversed;
}

/**
 * The same outline, wound so that SVG's non-zero rule draws it.
 *
 * Skia answers a boolean operation with contours that are correct under the
 * **even-odd** rule and makes no promise about which way each one goes — two
 * nested rings can come back turning the same way, which even-odd reads as a
 * hole and non-zero reads as solid. SVG fills with non-zero unless told
 * otherwise, and this document has nowhere to tell it otherwise: `Geometry` has
 * no fill rule, the arc preset already states its donut by winding the inner
 * ring backwards, and adding a second way to mean "hole" would make every
 * consumer ask which one it was looking at.
 *
 * So the answer is re-wound instead. The contours a boolean produces never
 * cross — that is what the operation guarantees — so each is simply inside some
 * number of the others, and alternating direction with that depth makes
 * non-zero agree with even-odd everywhere. Idempotent: an outline that already
 * alternates comes back untouched.
 */
export function nonZeroWound(segments: readonly PathSegment[]): PathSegment[] {
  const contours = contoursOf(segments);
  if (contours.length < 2) return segments.slice();

  const runs = contours.map((commands) => flattenPath(commands).flat());
  return contours.flatMap((commands, index) => {
    const run = runs[index];
    const start = run?.[0];
    if (run === undefined || start === undefined) return commands;
    const depth = runs.filter((other, at) => at !== index && pointInPolygon(start, other)).length;
    const area = signedArea(run);
    // Outermost turns one way, everything one level in turns the other. Which
    // way the outermost turns is not decided here — only that its holes
    // disagree with it, which is all non-zero reads.
    const wanted = depth % 2 === 0;
    if (area === 0 || area > 0 === wanted) return commands;
    return reversedContour(commands);
  });
}

export interface CombinePlan {
  /**
   * In selection order, which is the order the operands are read in — the
   * store's selection keeps insertion order for exactly this.
   */
  operands: CombineOperand[];
  /** The frontmost operand, whose place and paint the result takes. */
  front: CombineOperand;
  /** Where the result goes in the document's own list, once the operands are out. */
  index: number;
  /** The tree with every operand taken out of it, at whatever depth each sat. */
  remaining: IconNode[];
}

/**
 * Everything a boolean needs to know about the document, or null when this
 * selection cannot be combined at all.
 *
 * Worked out twice — once to build the operands and once again in the reducer
 * when the answer comes back — because the engine is asynchronous and the
 * document is free to move on in between. Deriving it rather than carrying it
 * across is what stops a stale plan writing a shape into a list that changed.
 *
 * **Where the result lands: the frontmost operand's place, at the top level.**
 * The operands are flattened into artboard units before the operation, so what
 * comes back is stated in no group's frame and belongs in none — and among
 * several places it could go, the frontmost is the only one where no operand
 * ends up behind something it was in front of. That is the same call
 * `groupSelection` makes, for the same reason. When the frontmost operand sits
 * inside a group, the result takes that group's place in the top-level list:
 * the group is what stood between it and the artboard, so that is its place
 * seen from outside.
 */
export function combinePlan(
  nodes: readonly IconNode[],
  ids: readonly string[],
): CombinePlan | null {
  const operands: CombineOperand[] = [];
  for (const id of ids) {
    const node = findNode(nodes, id);
    // A group is refused here as well as in the rail, and not because the rail
    // might be wrong: this is what a dispatch arriving after the document
    // changed under it runs into.
    if (node === null || isGroup(node)) return null;
    operands.push({ shape: node, frame: frameOf(nodes, id) });
  }
  const first = operands[0];
  if (first === undefined || operands.length < 2) return null;

  // Front-to-back through the whole tree, which is the order things are painted
  // in and therefore the only order "frontmost" can mean once a document nests.
  const painted = new Map(everyShape(nodes).map((shape, at) => [shape.id, at]));
  const depth = (operand: CombineOperand): number =>
    painted.get(operand.shape.id) ?? Number.POSITIVE_INFINITY;
  const front = operands.reduce((best, one) => (depth(one) < depth(best) ? one : best), first);

  const top = chainTo(nodes, front.shape.id)[0];
  if (top === undefined) return null;
  const removing = new Set(ids);
  return {
    operands,
    front,
    // Counted in survivors rather than read off the original list: the operands
    // in front of the anchor are about to leave, and an index measured before
    // they do would put the result behind them.
    index: nodes.slice(0, nodes.indexOf(top)).filter((node) => !removing.has(node.id)).length,
    remaining: withoutNodes(nodes, removing),
  };
}
