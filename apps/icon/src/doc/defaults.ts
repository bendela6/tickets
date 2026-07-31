import { DEFAULT_GROUND, DEFAULT_INK, REFERENCE_SIZE } from './constants';
import type { ArtboardSize, Geometry, IconDoc, IconObject, ShapeKind } from './types';

/**
 * Where a new shape lands, stated as fractions of the artboard so the same
 * call produces the same picture on a 256, 512 or 1024 board. The numerators
 * are the design's own 512-unit values.
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

function initialGeometry(kind: ShapeKind, size: number): Geometry {
  const at = (fraction: number) => Math.round(fraction * size);
  const centre = size / 2;
  switch (kind) {
    case 'rect':
      return {
        kind: 'rect',
        x: at(PLACEMENT.boxOrigin),
        y: at(PLACEMENT.boxOrigin),
        w: at(PLACEMENT.boxSide),
        h: at(PLACEMENT.boxSide),
        radius: at(PLACEMENT.rectRadius),
      };
    case 'ellipse':
      return {
        kind: 'ellipse',
        x: at(PLACEMENT.boxOrigin),
        y: at(PLACEMENT.boxOrigin),
        w: at(PLACEMENT.boxSide),
        h: at(PLACEMENT.boxSide),
      };
    case 'line':
      return {
        kind: 'line',
        x1: at(PLACEMENT.lineStart),
        y1: centre,
        x2: at(PLACEMENT.lineEnd),
        y2: centre,
      };
    case 'polygon':
      return {
        kind: 'polygon',
        cx: centre,
        cy: centre,
        r: at(PLACEMENT.polygonRadius),
        sides: DEFAULT_SIDES,
      };
  }
}

/**
 * A fresh object of `kind`. `sequence` is the running count of shapes ever
 * added to this document, so names stay stable when earlier ones are deleted —
 * numbering by `objects.length` would hand a new shape a name a deleted one
 * already used, and undo would then have two `rect 2`s to tell apart.
 */
export function newObject(kind: ShapeKind, sequence: number, size: ArtboardSize): IconObject {
  return {
    id: `${kind}-${sequence}`,
    name: `${kind} ${sequence}`,
    geometry: initialGeometry(kind, size),
    fill: { ...DEFAULT_INK },
    stroke: { ...DEFAULT_INK },
    strokeWidth: kind === 'line' ? Math.round(PLACEMENT.lineWidth * size) : 0,
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
export function emptyDocument(name: string, size: ArtboardSize = 512): IconDoc {
  return {
    name,
    size,
    background: { ...DEFAULT_GROUND },
    objects: [],
    states: [{ id: 'state-1', name: 'default', sustain: null }],
    timing: { speed: 1, ramp: 'soft', rest: 0.08 },
  };
}
