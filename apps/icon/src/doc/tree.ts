import {
  boxCentre,
  boxCorners,
  boxesOverlap,
  bounds,
  centreOf,
  contains,
  pointsBox,
  rotatePoint,
  rotatedBounds,
  unionBox,
  type Box,
  type Point,
} from './geometry';
import type { Geometry, IconGroup, IconNode, IconObject, PathSegment } from './types';

/**
 * The tree, and the one transform a group can carry.
 *
 * A document's object list used to be flat, and the two things that changed
 * when it stopped being flat are both in here: a node is now a shape *or* a
 * group, and a shape's coordinates are stated in the frame of whatever list it
 * sits in rather than in the artboard's. Everything that has to cross between
 * those two frames — hit-testing, the selection outline, the handles, a drag —
 * goes through `Placement` below and through nothing else.
 */

/**
 * Whether a node is a group.
 *
 * Structural rather than tagged: a document written before groups existed is a
 * list of shapes with no marker on them, and it has to keep loading as the tree
 * it already is. A field like `node: 'shape'` would have made every one of
 * those documents invalid and bought nothing — `children` is present on exactly
 * one member of the union, so the compiler narrows on it just as tightly.
 */
export const isGroup = (node: IconNode): node is IconGroup => 'children' in node;

/**
 * How one frame sits inside another: a uniform scale, a turn about the origin,
 * and then a move.
 *
 * A similarity and not a general matrix, because that is exactly what a
 * `GroupTransform` can be — and because similarities compose to similarities,
 * so a chain of five nested groups is still four numbers rather than a matrix
 * stack. It is stated as "where the local origin lands" rather than as a pivot
 * and an offset because that form composes in one line and is what SVG's own
 * `translate rotate scale` chain means.
 */
export interface Placement {
  scale: number;
  /** Degrees. */
  rotation: number;
  /** Where the local origin lands in the outer frame. */
  x: number;
  y: number;
}

/** The document's own frame: a node at the top level is already in artboard units. */
export const ARTBOARD_FRAME: Placement = { scale: 1, rotation: 0, x: 0, y: 0 };

/**
 * A scale of zero has no inverse, and every route into a group's transform
 * clamps to this rather than letting one exist. It is far below one document
 * unit on the largest artboard, so nothing usable is refused by it.
 */
export const MIN_SCALE = 0.001;

export const clampScale = (scale: number): number =>
  Number.isFinite(scale) ? Math.max(MIN_SCALE, scale) : 1;

const radiansOf = (degrees: number): { cos: number; sin: number } => {
  const radians = (degrees * Math.PI) / 180;
  return { cos: Math.cos(radians), sin: Math.sin(radians) };
};

/** A direction through a placement. A direction has no position, so no offset. */
export function placeVector(frame: Placement, vector: Point): Point {
  const { cos, sin } = radiansOf(frame.rotation);
  return {
    x: frame.scale * (vector.x * cos - vector.y * sin),
    y: frame.scale * (vector.x * sin + vector.y * cos),
  };
}

/** The same direction read back into the inner frame. */
export function unplaceVector(frame: Placement, vector: Point): Point {
  const { cos, sin } = radiansOf(-frame.rotation);
  const x = vector.x / frame.scale;
  const y = vector.y / frame.scale;
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/** A point out into the outer frame. */
export function place(frame: Placement, point: Point): Point {
  const turned = placeVector(frame, point);
  return { x: frame.x + turned.x, y: frame.y + turned.y };
}

/** A point back into the inner frame — the exact inverse of `place`. */
export function unplace(frame: Placement, point: Point): Point {
  return unplaceVector(frame, { x: point.x - frame.x, y: point.y - frame.y });
}

/** `inner` seen from outside `outer`. Applying this is applying both, in order. */
export function composePlacement(outer: Placement, inner: Placement): Placement {
  const origin = place(outer, { x: inner.x, y: inner.y });
  return {
    scale: outer.scale * inner.scale,
    rotation: outer.rotation + inner.rotation,
    x: origin.x,
    y: origin.y,
  };
}

/**
 * The group's own transform as a placement.
 *
 * The stored form turns and scales about the group's *centre*, because that is
 * what a rotation knob and a corner handle mean. A placement turns and scales
 * about the origin, because that is what composes. The two are the same map
 * written differently, and the conversion is this one line: whatever the pivot
 * drifts to under the turn is subtracted back out of the offset.
 */
export function placementOf(group: IconGroup): Placement {
  const centre = boxCentre(contentBox(group));
  const { x, y, rotation, scale } = group.transform;
  const held = placeVector({ scale, rotation, x: 0, y: 0 }, centre);
  return {
    scale: clampScale(scale),
    rotation,
    x: x + centre.x - held.x,
    y: y + centre.y - held.y,
  };
}

/**
 * A turn about a point, as a placement.
 *
 * A shape's own `rotation` is stated about the centre of its own box, exactly
 * as a group's is about its content centre — and the conversion is the same one
 * line as above, for the same reason. It is stated separately because a shape
 * has no `GroupTransform` to be read out of, and anything that has to hand a
 * shape's coordinates to something outside the document needs that turn as a
 * frame rather than as a field beside them.
 */
export function spinAbout(centre: Point, degrees: number): Placement {
  const held = placeVector({ scale: 1, rotation: degrees, x: 0, y: 0 }, centre);
  return { scale: 1, rotation: degrees, x: centre.x - held.x, y: centre.y - held.y };
}

/**
 * The transform that puts the group's content centre at `centre` (stated in the
 * group's parent frame) — the inverse of the one line above, which every
 * gesture that moves or resizes a group ends in.
 */
export function transformAt(
  group: IconGroup,
  centre: Point,
  rotation: number,
  scale: number,
): IconGroup['transform'] {
  const own = boxCentre(contentBox(group));
  return { x: centre.x - own.x, y: centre.y - own.y, rotation, scale: clampScale(scale) };
}

/** Where the group's content centre currently sits, in its parent's frame. */
export const centreOfGroup = (group: IconGroup): Point => {
  const own = boxCentre(contentBox(group));
  return { x: group.transform.x + own.x, y: group.transform.y + own.y };
};

/** A box through a placement, boxed again — the turn makes it a new box. */
export function boxThrough(box: Box, frame: Placement): Box {
  return pointsBox(boxCorners(box).map((corner) => place(frame, corner)));
}

/**
 * What a group's children occupy, in the group's own frame — its geometry, in
 * the only sense a group has any.
 *
 * A group with nothing in it has no position of its own to report, so it
 * answers with a box of no size at the origin rather than with nothing: it can
 * still be selected, named and deleted from the rail, and every caller below
 * would otherwise need a case for a shape that is not there.
 */
export function contentBox(group: IconGroup): Box {
  return unionBox(group.children.map(localBounds)) ?? { x: 0, y: 0, w: 0, h: 0 };
}

/** A node's axis-aligned box in the frame of the list that holds it. */
export function localBounds(node: IconNode): Box {
  return isGroup(node) ? boxThrough(contentBox(node), placementOf(node)) : rotatedBounds(node);
}

/**
 * The box and the angle a selection outline is drawn at, in artboard units.
 *
 * One function for both kinds because the outline is one idea: an upright box
 * in the thing's own frame, turned by however much that frame and the thing
 * itself are turned. A shape brings its own `bounds` and its own `rotation`; a
 * group brings its children's box and the turn its transform carries.
 */
export function outlineOf(node: IconNode, frame: Placement): { box: Box; rotation: number } {
  const inner = isGroup(node) ? composePlacement(frame, placementOf(node)) : frame;
  const box = isGroup(node) ? contentBox(node) : bounds(node);
  const centre = place(inner, boxCentre(box));
  const w = box.w * inner.scale;
  const h = box.h * inner.scale;
  const rotation = inner.rotation + (isGroup(node) ? 0 : node.rotation);
  return { box: { x: centre.x - w / 2, y: centre.y - h / 2, w, h }, rotation };
}

/* ── finding things ─────────────────────────────────────────────────────── */

/**
 * The chain from the top of the document down to `id`, the node itself last, or
 * an empty list when nothing has that id.
 *
 * One traversal answers every question the rest of the app asks about where a
 * node sits: its parent, its frame, whether an ancestor has hidden or locked
 * it, and which groups the rail must show as open around it.
 */
export function chainTo(nodes: readonly IconNode[], id: string): IconNode[] {
  for (const node of nodes) {
    if (node.id === id) return [node];
    if (!isGroup(node)) continue;
    const deeper = chainTo(node.children, id);
    if (deeper.length > 0) return [node, ...deeper];
  }
  return [];
}

export function findNode(nodes: readonly IconNode[], id: string): IconNode | null {
  return chainTo(nodes, id).at(-1) ?? null;
}

/** The groups above `id`, outermost first. Empty for a node at the top level. */
export function ancestorsOf(nodes: readonly IconNode[], id: string): IconGroup[] {
  return chainTo(nodes, id).slice(0, -1).filter(isGroup);
}

/** The frame a node's own coordinates are stated in. */
export function frameOf(nodes: readonly IconNode[], id: string): Placement {
  return ancestorsOf(nodes, id).reduce(
    (frame, group) => composePlacement(frame, placementOf(group)),
    ARTBOARD_FRAME,
  );
}

/** The list a node sits in, and the frame that list is stated in. */
export function siblingsOf(
  nodes: readonly IconNode[],
  id: string,
): { list: readonly IconNode[]; parentId: string | null; frame: Placement } {
  const above = ancestorsOf(nodes, id);
  const parent = above.at(-1);
  return {
    list: parent ? parent.children : nodes,
    parentId: parent?.id ?? null,
    frame: frameOf(nodes, id),
  };
}

/**
 * The list a click picks from, given the groups currently entered.
 *
 * An entered group that is no longer there resolves to the deepest part of the
 * chain that still is, rather than to nothing: an undo can take a group away
 * while you are standing inside it.
 */
export function levelOf(
  nodes: readonly IconNode[],
  entered: readonly string[],
): { list: readonly IconNode[]; parentId: string | null; frame: Placement } {
  let list: readonly IconNode[] = nodes;
  let frame = ARTBOARD_FRAME;
  let parentId: string | null = null;
  for (const id of entered) {
    const next = list.find((node) => node.id === id);
    if (!next || !isGroup(next)) break;
    frame = composePlacement(frame, placementOf(next));
    list = next.children;
    parentId = next.id;
  }
  return { list, parentId, frame };
}

/** The entered chain with anything that has stopped being a group cut off. */
export function prunedEntry(nodes: readonly IconNode[], entered: readonly string[]): string[] {
  const kept: string[] = [];
  let list: readonly IconNode[] = nodes;
  for (const id of entered) {
    const next = list.find((node) => node.id === id);
    if (!next || !isGroup(next)) break;
    kept.push(id);
    list = next.children;
  }
  return kept;
}

/** Every node in the tree, top level first, each group before its children. */
export function everyNode(nodes: readonly IconNode[]): IconNode[] {
  return nodes.flatMap((node) => (isGroup(node) ? [node, ...everyNode(node.children)] : [node]));
}

/** One shape, with the frame its coordinates are stated in. */
export interface PlacedShape {
  shape: IconObject;
  frame: Placement;
}

/**
 * Every shape in the tree that is actually drawn, front to back, each with the
 * frame it lives in.
 *
 * A hidden group takes its children with it — that is the whole of "hidden
 * propagates down", stated once here so the renderer, the marquee, the safe
 * zone check and the hit test all inherit it rather than each remembering.
 */
export function visibleShapes(
  nodes: readonly IconNode[],
  frame: Placement = ARTBOARD_FRAME,
): PlacedShape[] {
  const out: PlacedShape[] = [];
  for (const node of nodes) {
    if (node.hidden) continue;
    if (isGroup(node)) {
      out.push(...visibleShapes(node.children, composePlacement(frame, placementOf(node))));
    } else {
      out.push({ shape: node, frame });
    }
  }
  return out;
}

/** Every shape in the tree, drawn or not, front to back. */
export function everyShape(nodes: readonly IconNode[]): IconObject[] {
  return nodes.flatMap((node) => (isGroup(node) ? everyShape(node.children) : [node]));
}

/**
 * Whether an ancestor has locked the node, or the node itself has.
 *
 * Locking a group is a statement about everything in it — the point of locking
 * a group is that the arrangement inside it stays put — so a child of a locked
 * group is locked whatever its own flag says.
 */
export function isLocked(nodes: readonly IconNode[], id: string): boolean {
  return chainTo(nodes, id).some((node) => node.locked);
}

/** The same for visibility: a hidden group hides everything inside it. */
export function isHidden(nodes: readonly IconNode[], id: string): boolean {
  return chainTo(nodes, id).some((node) => node.hidden);
}

/* ── hit-testing ────────────────────────────────────────────────────────── */

/** Whether any drawn shape under `node` is under the artboard-space point. */
export function nodeContains(node: IconNode, frame: Placement, point: Point): boolean {
  if (node.hidden) return false;
  if (!isGroup(node)) return contains(node, unplace(frame, point));
  const inner = composePlacement(frame, placementOf(node));
  return node.children.some((child) => nodeContains(child, inner, point));
}

/**
 * What a click at `point` selects, given the groups currently entered.
 *
 * A click always lands on a member of the level you are standing in, never on
 * the shape inside a group that happens to be under the pointer: clicking a
 * group selects the group, and it takes a double-click to go in. The search
 * still reaches all the way down — a group is hit wherever any of its children
 * is — so a group is exactly as clickable as the artwork it holds and no more.
 */
export function nodeAt(
  nodes: readonly IconNode[],
  point: Point,
  entered: readonly string[],
): IconNode | null {
  const level = levelOf(nodes, entered);
  for (const node of level.list) {
    if (nodeContains(node, level.frame, point)) return node;
  }
  return null;
}

/** The shape itself under the pointer, wherever in the tree it is. */
export function shapeAt(
  nodes: readonly IconNode[],
  point: Point,
  frame: Placement = ARTBOARD_FRAME,
): PlacedShape | null {
  for (const placed of visibleShapes(nodes, frame)) {
    if (contains(placed.shape, unplace(placed.frame, point))) return placed;
  }
  return null;
}

/**
 * Every member of the current level a marquee catches.
 *
 * Measured on each member's own box in artboard units, which for a group is the
 * box round everything in it — a band that clips one child of a group catches
 * the group, because the group is what a click there would have selected.
 */
export function nodesInBox(
  nodes: readonly IconNode[],
  box: Box,
  entered: readonly string[],
): IconNode[] {
  const level = levelOf(nodes, entered);
  return level.list.filter(
    (node) => !node.hidden && boxesOverlap(boxThrough(localBounds(node), level.frame), box),
  );
}

/* ── rewriting ──────────────────────────────────────────────────────────── */

/** The tree with one node replaced, wherever it is. */
export function mapNode(
  nodes: readonly IconNode[],
  id: string,
  fn: (node: IconNode) => IconNode,
): IconNode[] {
  return nodes.map((node) => {
    if (node.id === id) return fn(node);
    if (!isGroup(node)) return node;
    const children = mapNode(node.children, id, fn);
    return children === node.children ? node : { ...node, children };
  });
}

/** The tree with every node named in `ids` taken out, at whatever depth. */
export function withoutNodes(nodes: readonly IconNode[], ids: ReadonlySet<string>): IconNode[] {
  const kept: IconNode[] = [];
  for (const node of nodes) {
    if (ids.has(node.id)) continue;
    kept.push(isGroup(node) ? { ...node, children: withoutNodes(node.children, ids) } : node);
  }
  return kept;
}

/** A group's child list, or the document's own when `parentId` is null. */
export function listAt(
  nodes: readonly IconNode[],
  parentId: string | null,
): readonly IconNode[] | null {
  if (parentId === null) return nodes;
  const parent = findNode(nodes, parentId);
  return parent && isGroup(parent) ? parent.children : null;
}

/** The tree with one group's child list rewritten. `null` names the top level. */
export function mapList(
  nodes: readonly IconNode[],
  parentId: string | null,
  fn: (list: readonly IconNode[]) => IconNode[],
): IconNode[] {
  if (parentId === null) return fn(nodes);
  return mapNode(nodes, parentId, (node) =>
    isGroup(node) ? { ...node, children: fn(node.children) } : node,
  );
}

/* ── pushing a group's transform into its children ──────────────────────── */

/**
 * Every coordinate of a geometry through a point map, with `turn` added to any
 * arc's own axis.
 *
 * Only ever called with a similarity, which is the one class of map that leaves
 * a run of points a run of points, a cubic a cubic and a circular arc a
 * circular arc — so nothing here has to approximate anything.
 */
function mapPoints(
  geometry: Geometry,
  at: (point: Point) => Point,
  turn: number,
  scale: number,
): Geometry {
  switch (geometry.kind) {
    case 'line': {
      const a = at({ x: geometry.x1, y: geometry.y1 });
      const b = at({ x: geometry.x2, y: geometry.y2 });
      return { ...geometry, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
    case 'polyline':
    case 'polygon':
      return { ...geometry, points: geometry.points.map(at) };
    case 'path':
      return { ...geometry, segments: geometry.segments.map(mapSegment(at, turn, scale)) };
    default:
      return geometry;
  }
}

const mapSegment =
  (at: (point: Point) => Point, turn: number, scale: number) =>
  (segment: PathSegment): PathSegment => {
    switch (segment.c) {
      case 'Z':
        return segment;
      case 'Q': {
        const control = at({ x: segment.x1, y: segment.y1 });
        return { ...segment, x1: control.x, y1: control.y, ...at(segment) };
      }
      case 'C': {
        const first = at({ x: segment.x1, y: segment.y1 });
        const second = at({ x: segment.x2, y: segment.y2 });
        return {
          ...segment,
          x1: first.x,
          y1: first.y,
          x2: second.x,
          y2: second.y,
          ...at(segment),
        };
      }
      case 'A':
        return {
          ...segment,
          rx: segment.rx * scale,
          ry: segment.ry * scale,
          rotation: segment.rotation + turn,
          ...at(segment),
        };
      default:
        return { ...segment, ...at(segment) };
    }
  };

/**
 * A run of path commands through a placement.
 *
 * The very map `nodeThrough` applies to a shape that *is* its coordinates,
 * offered on its own because a boolean operation needs commands in artboard
 * units before there is any object to hang them on. Sharing the one mapper is
 * the point: an arc's own axis turns with the frame and its radii scale with
 * it, and a second spelling of that would be a second chance to get it wrong.
 */
export function segmentsThrough(
  segments: readonly PathSegment[],
  frame: Placement,
): PathSegment[] {
  return segments.map(mapSegment((point) => place(frame, point), frame.rotation, frame.scale));
}

/**
 * A shape with its own turn written into its coordinates instead of carried
 * beside them.
 *
 * Needed because a stored rotation is about the centre of the shape's own box,
 * and a box does not survive being turned: two turns about two different
 * centres are not a third turn about either. Baking the inner one first leaves
 * exactly one turn to reason about. Only the kinds that *are* their coordinates
 * can be baked — a rect is a box and a circle is a centre and a radius, and
 * neither has anywhere to put a turn — which is why the caller never asks.
 */
function unturned(shape: IconObject): Geometry {
  const centre = centreOf(shape);
  const turn = shape.rotation;
  return mapPoints(shape.geometry, (point) => rotatePoint(point, centre, turn), turn, 1);
}

/**
 * One node moved out of a group and into the group's own list, drawing exactly
 * what it drew before.
 *
 * A box, a circle and an ellipse take the whole placement without touching
 * their coordinates: their centre moves, their size scales, and the turn joins
 * the one they already carry — which is exact, because a turned rectangle *is*
 * a rectangle with a rotation. Everything else is its coordinates, so the
 * placement is applied to each of them and no rotation is left over at all.
 */
export function nodeThrough(node: IconNode, frame: Placement): IconNode {
  if (isGroup(node)) {
    const own = placementOf(node);
    const moved = composePlacement(frame, own);
    const centre = place(frame, centreOfGroup(node));
    return {
      ...node,
      transform: transformAt(node, centre, moved.rotation, moved.scale),
    };
  }
  const at = (point: Point) => place(frame, point);
  // The stroke scales with everything else, because inside the group it already
  // did: `<g transform="scale(2)">` draws its children's strokes twice as wide,
  // and a shape lifted out of one has to keep the width it was being drawn at.
  const shape = { ...node, strokeWidth: node.strokeWidth * frame.scale };
  switch (node.geometry.kind) {
    case 'rect':
    case 'ellipse': {
      const g = node.geometry;
      const centre = at({ x: g.x + g.w / 2, y: g.y + g.h / 2 });
      const w = g.w * frame.scale;
      const h = g.h * frame.scale;
      const box = { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
      return {
        ...shape,
        geometry:
          g.kind === 'rect' ? { ...g, ...box, radius: g.radius * frame.scale } : { ...g, ...box },
        rotation: node.rotation + frame.rotation,
      };
    }
    case 'circle': {
      const g = node.geometry;
      const centre = at({ x: g.cx, y: g.cy });
      return {
        ...shape,
        geometry: { ...g, cx: centre.x, cy: centre.y, r: g.r * frame.scale },
        rotation: node.rotation + frame.rotation,
      };
    }
    default: {
      const flat = node.rotation === 0 ? node.geometry : unturned(node);
      return {
        ...shape,
        geometry: mapPoints(flat, at, frame.rotation, frame.scale),
        rotation: 0,
      };
    }
  }
}

/**
 * A group's children as they would sit in the group's own list.
 *
 * The identity case is short-circuited and returns the very objects that went
 * in, which is what makes grouping and ungrouping a round trip rather than a
 * near miss: a fresh group carries no transform, so there is nothing to push
 * down, and pushing "nothing" through the general path would still bake a
 * point list's own rotation into its coordinates and hand back a different —
 * identical-looking — document.
 */
export function dissolved(group: IconGroup): IconNode[] {
  const frame = placementOf(group);
  if (frame.scale === 1 && frame.rotation === 0 && frame.x === 0 && frame.y === 0) {
    return group.children.slice();
  }
  return group.children.map((child) => nodeThrough(child, frame));
}
