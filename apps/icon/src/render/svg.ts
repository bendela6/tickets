import { centreOf, polygonPoints } from '../doc/geometry';
import { poseAtState } from '../doc/pose';
import type { Ground, IconDoc, IconObject, PosedObject } from '../doc/types';

/**
 * The document as SVG. This is the only place artwork is drawn for export —
 * every raster target rasterises this string, so a shape can never look
 * different in a PNG than it does on screen.
 *
 * Output is deterministic: fixed attribute order, fixed number formatting, no
 * generated ids. That is what lets a test compare two renders directly.
 */

/** Trim float noise without turning integers into `1.00`. */
function n(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function colourFor(object: IconObject, ground: Ground): string {
  // A line is drawn with its stroke; everything else with its fill. Giving a
  // line a fill would paint nothing and silently lose the object.
  const pair = object.geometry.kind === 'line' ? object.stroke : object.fill;
  return pair[ground];
}

/**
 * The outline on a shape that has an area. Emitted only when there is one to
 * draw — a `stroke-width` of 0 with a colour is dead weight in every exported
 * file, and there is one per size per target.
 */
function strokeAttributes(object: PosedObject, ground: Ground): string {
  if (object.geometry.kind === 'line' || object.strokeWidth <= 0) return '';
  return ` stroke="${escapeAttribute(object.stroke[ground])}" stroke-width="${n(object.strokeWidth)}"`;
}

function transformOf(object: PosedObject): string {
  if (object.rotation % 360 === 0) return '';
  const c = centreOf(object);
  return ` transform="rotate(${n(object.rotation)} ${n(c.x)} ${n(c.y)})"`;
}

function opacityOf(object: PosedObject): string {
  return object.opacity >= 100 ? '' : ` opacity="${n(object.opacity / 100)}"`;
}

function shapeMarkup(object: PosedObject, ground: Ground): string {
  const g = object.geometry;
  const colour = escapeAttribute(colourFor(object, ground));
  const tail = `${strokeAttributes(object, ground)}${opacityOf(object)}${transformOf(object)}`;

  switch (g.kind) {
    case 'rect': {
      const radius = g.radius > 0 ? ` rx="${n(g.radius)}"` : '';
      return `<rect x="${n(g.x)}" y="${n(g.y)}" width="${n(g.w)}" height="${n(g.h)}"${radius} fill="${colour}"${tail}/>`;
    }
    case 'ellipse':
      return `<ellipse cx="${n(g.x + g.w / 2)}" cy="${n(g.y + g.h / 2)}" rx="${n(g.w / 2)}" ry="${n(g.h / 2)}" fill="${colour}"${tail}/>`;
    case 'line':
      return `<line x1="${n(g.x1)}" y1="${n(g.y1)}" x2="${n(g.x2)}" y2="${n(g.y2)}" stroke="${colour}" stroke-width="${n(object.strokeWidth)}" stroke-linecap="round"${tail}/>`;
    case 'polygon': {
      const points = polygonPoints(g.cx, g.cy, g.r, g.sides)
        .map((p) => `${n(p.x)},${n(p.y)}`)
        .join(' ');
      return `<polygon points="${points}" fill="${colour}"${tail}/>`;
    }
  }
}

export interface RenderOptions {
  /** Which half of every colour pair to paint. */
  ground: Ground;
  /** Which state's pose to draw. Defaults to the first. */
  stateId?: string;
  /**
   * Draw the artboard's own background. Off for targets that want
   * transparency — a monochrome mask, an SVG favicon meant to sit on a page.
   */
  background?: boolean;
}

export function renderSvg(doc: IconDoc, options: RenderOptions): string {
  const stateId = options.stateId ?? doc.states[0]?.id ?? '';
  const posed = poseAtState(doc, stateId);
  return renderPosed(doc, posed, options);
}

/**
 * The same drawing from an already-posed object list — what the live canvas
 * and the animated exports use, where the pose comes from a moment rather than
 * from a state.
 */
export function renderPosed(
  doc: IconDoc,
  posed: PosedObject[],
  options: RenderOptions,
): string {
  const { ground, background = true } = options;
  const size = doc.size;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
  ];
  if (background) {
    parts.push(
      `<rect x="0" y="0" width="${size}" height="${size}" fill="${escapeAttribute(doc.background[ground])}"/>`,
    );
  }
  // Document order is front-to-back; SVG paints in source order, so the list
  // is reversed to put the frontmost object last.
  for (const object of [...posed].reverse()) {
    if (object.hidden) continue;
    parts.push(shapeMarkup(object, ground));
  }
  parts.push('</svg>');
  return parts.join('');
}
