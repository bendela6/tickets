import { DEFAULT_GROUND, DEFAULT_INK, REFERENCE_SIZE } from './constants';
import { snapGeometry, snapTo } from './snap';
import type { Artboard, Geometry, IconDoc, IconObject, ShapeKind } from './types';

/**
 * Where a new shape lands, stated as fractions of the artboard so the same
 * call produces the same picture on a 16, 512 or 1024 board — and on a wide
 * one. The numerators are the design's own 512-unit values.
 */
const PLACEMENT = {
  boxOrigin: 136 / REFERENCE_SIZE,
  boxSide: 240 / REFERENCE_SIZE,
  rectRadius: 32 / REFERENCE_SIZE,
  lineStart: 136 / REFERENCE_SIZE,
  lineEnd: 376 / REFERENCE_SIZE,
  lineWidth: 20 / REFERENCE_SIZE,
  polygonRadius: 120 / REFERENCE_SIZE,
} as const;

const DEFAULT_SIDES = 6;

function initialGeometry(kind: ShapeKind, artboard: Artboard): Geometry {
  const { width, height } = artboard;
  // The shorter edge governs anything that has to stay round — a polygon on a
  // wide board should not spill off the top and bottom.
  const shorter = Math.min(width, height);
  const centre = { x: width / 2, y: height / 2 };

  switch (kind) {
    case 'rect':
    case 'ellipse': {
      const w = PLACEMENT.boxSide * width;
      const h = PLACEMENT.boxSide * height;
      const box = { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
      if (kind === 'ellipse') return { kind: 'ellipse', ...box };
      return { kind: 'rect', ...box, radius: PLACEMENT.rectRadius * shorter };
    }
    case 'line': {
      const half = ((PLACEMENT.lineEnd - PLACEMENT.lineStart) * width) / 2;
      return {
        kind: 'line',
        x1: centre.x - half,
        y1: centre.y,
        x2: centre.x + half,
        y2: centre.y,
      };
    }
    case 'polygon':
      return {
        kind: 'polygon',
        cx: centre.x,
        cy: centre.y,
        r: PLACEMENT.polygonRadius * shorter,
        sides: DEFAULT_SIDES,
      };
  }
}

/**
 * The id a shape gets from its kind and sequence number.
 *
 * Shared rather than spelled out twice: alt-dragging duplicates an object and
 * then has to keep dragging the copy, which means the caller must know the new
 * id before the reducer's state comes back. Both sides derive it from here so
 * they cannot disagree.
 */
export function objectId(kind: ShapeKind, sequence: number): string {
  return `${kind}-${sequence}`;
}

/**
 * A fresh object of `kind`, already on the document's grid. `sequence` is the
 * running count of shapes ever added, so names stay stable when earlier ones
 * are deleted — numbering by `objects.length` would hand a new shape a name a
 * deleted one already used, and undo would then have two `rect 2`s to tell
 * apart.
 */
export function newObject(
  kind: ShapeKind,
  sequence: number,
  artboard: Artboard,
  snap = 1,
): IconObject {
  const shorter = Math.min(artboard.width, artboard.height);
  return {
    id: objectId(kind, sequence),
    name: `${kind} ${sequence}`,
    geometry: snapGeometry(initialGeometry(kind, artboard), snap),
    fill: { ...DEFAULT_INK },
    stroke: { ...DEFAULT_INK },
    strokeWidth:
      kind === 'line' ? Math.max(snap, snapTo(PLACEMENT.lineWidth * shorter, snap)) : 0,
    opacity: 100,
    rotation: 0,
    hidden: false,
    locked: false,
    motion: { takesPart: true, role: 'spins', pace: 1 },
  };
}

/**
 * A new document. One state, because a purely static icon is the common case
 * and a tool that insists on a second state is inventing motion the icon does
 * not need.
 */
export function emptyDocument(name: string, artboard: Artboard = { width: 512, height: 512 }): IconDoc {
  return {
    name,
    artboard: { ...artboard },
    snap: 1,
    background: { ...DEFAULT_GROUND },
    objects: [],
    states: [{ id: 'state-1', name: 'default', sustain: null }],
    timing: { speed: 1, ramp: 'soft', rest: 0.08 },
  };
}
