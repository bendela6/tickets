import { centreOf, isOpenRun } from '../doc/geometry';
import { isGroup, placementOf } from '../doc/tree';
import type { Ground, IconDoc, IconGroup, IconNode, IconObject, PathSegment } from '../doc/types';

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
  // A run is drawn with its stroke; everything else with its fill. Giving a
  // line a fill would paint nothing and silently lose the object.
  const pair = isOpenRun(object.geometry) ? object.stroke : object.fill;
  return pair[ground];
}

/**
 * The outline on a shape that has an area. Emitted only when there is one to
 * draw — a `stroke-width` of 0 with a colour is dead weight in every exported
 * file, and there is one per size per target.
 */
function strokeAttributes(object: IconObject, ground: Ground): string {
  if (isOpenRun(object.geometry) || object.strokeWidth <= 0) return '';
  return ` stroke="${escapeAttribute(object.stroke[ground])}" stroke-width="${n(object.strokeWidth)}"`;
}

/** A point list as SVG's `points` attribute wants it. */
function pointList(points: readonly { x: number; y: number }[]): string {
  return points.map((point) => `${n(point.x)},${n(point.y)}`).join(' ');
}

/**
 * The `d` attribute: the commands in the order they are stored, spelled out
 * absolute.
 *
 * Exported because it is the single statement of what a path *is* in SVG, and
 * the toolbar's own glyph draws the arc preset with it — a second spelling
 * would be a second thing to get wrong. Flags are written as the digits SVG
 * reads them as; every other number goes through the same trimming the rest of
 * the file uses.
 */
export function pathData(segments: readonly PathSegment[]): string {
  return segments
    .map((segment) => {
      switch (segment.c) {
        case 'M':
        case 'L':
          return `${segment.c} ${n(segment.x)} ${n(segment.y)}`;
        case 'Q':
          return `Q ${n(segment.x1)} ${n(segment.y1)} ${n(segment.x)} ${n(segment.y)}`;
        case 'C':
          return `C ${n(segment.x1)} ${n(segment.y1)} ${n(segment.x2)} ${n(segment.y2)} ${n(segment.x)} ${n(segment.y)}`;
        case 'A':
          return `A ${n(segment.rx)} ${n(segment.ry)} ${n(segment.rotation)} ${segment.large ? 1 : 0} ${segment.sweep ? 1 : 0} ${n(segment.x)} ${n(segment.y)}`;
        case 'Z':
          return 'Z';
      }
    })
    .join(' ');
}

function transformOf(object: IconObject): string {
  if (object.rotation % 360 === 0) return '';
  const c = centreOf(object);
  return ` transform="rotate(${n(object.rotation)} ${n(c.x)} ${n(c.y)})"`;
}

function opacityOf(node: IconNode): string {
  return node.opacity >= 100 ? '' : ` opacity="${n(node.opacity / 100)}"`;
}

/**
 * A group's transform, spelled the way SVG spells one.
 *
 * The model turns and scales a group about its own centre, because that is what
 * a rotation knob and a corner handle mean. SVG chains its transforms from the
 * origin, so the pivot is folded into the translate on the way out — exactly,
 * and in this one place. The three primitives are written in the order SVG
 * applies them, and each is left out when it is the identity: a group that has
 * only been moved reads `translate(10 20)` and nothing else, which is what
 * anyone opening the exported file would have written by hand.
 */
function transformOfGroup(group: IconGroup): string {
  const { scale, rotation, x, y } = placementOf(group);
  const parts: string[] = [];
  if (x !== 0 || y !== 0) parts.push(`translate(${n(x)} ${n(y)})`);
  if (rotation % 360 !== 0) parts.push(`rotate(${n(rotation)})`);
  if (scale !== 1) parts.push(`scale(${n(scale)})`);
  return parts.length === 0 ? '' : ` transform="${parts.join(' ')}"`;
}

function shapeMarkup(object: IconObject, ground: Ground): string {
  const g = object.geometry;
  const colour = escapeAttribute(colourFor(object, ground));
  const tail = `${strokeAttributes(object, ground)}${opacityOf(object)}${transformOf(object)}`;

  switch (g.kind) {
    case 'rect': {
      const radius = g.radius > 0 ? ` rx="${n(g.radius)}"` : '';
      return `<rect x="${n(g.x)}" y="${n(g.y)}" width="${n(g.w)}" height="${n(g.h)}"${radius} fill="${colour}"${tail}/>`;
    }
    case 'circle':
      return `<circle cx="${n(g.cx)}" cy="${n(g.cy)}" r="${n(g.r)}" fill="${colour}"${tail}/>`;
    case 'ellipse':
      return `<ellipse cx="${n(g.x + g.w / 2)}" cy="${n(g.y + g.h / 2)}" rx="${n(g.w / 2)}" ry="${n(g.h / 2)}" fill="${colour}"${tail}/>`;
    case 'line':
      return `<line x1="${n(g.x1)}" y1="${n(g.y1)}" x2="${n(g.x2)}" y2="${n(g.y2)}" stroke="${colour}" stroke-width="${n(object.strokeWidth)}" stroke-linecap="round"${tail}/>`;
    case 'polyline':
      // `fill="none"` is not a default: SVG fills a polyline as though it were
      // closed, so an open run left to itself paints the area it does not
      // enclose. The joins are rounded because its corners are its own.
      return `<polyline points="${pointList(g.points)}" fill="none" stroke="${colour}" stroke-width="${n(object.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${tail}/>`;
    case 'polygon':
      return `<polygon points="${pointList(g.points)}" fill="${colour}"${tail}/>`;
    case 'path':
      // The same two ways a point list is drawn, decided by the path itself:
      // one that never closes encloses nothing, so it is stroked and left
      // unfilled exactly as a polyline is.
      return isOpenRun(g)
        ? `<path d="${pathData(g.segments)}" fill="none" stroke="${colour}" stroke-width="${n(object.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${tail}/>`
        : `<path d="${pathData(g.segments)}" fill="${colour}"${tail}/>`;
  }
}

/**
 * One list of nodes, painted back to front.
 *
 * The list is reversed at every level and not only at the top: front-to-back is
 * a property of a list of objects, and a group holds one of those.
 *
 * A hidden group is skipped whole, children and all — which is the model's
 * "hidden propagates down" and costs nothing to say here, because a `<g>` that
 * is not emitted cannot emit anything inside it.
 */
function nodesMarkup(nodes: readonly IconNode[], ground: Ground): string[] {
  const parts: string[] = [];
  for (const node of [...nodes].reverse()) {
    if (node.hidden) continue;
    if (isGroup(node)) {
      parts.push(`<g${transformOfGroup(node)}${opacityOf(node)}>`);
      parts.push(...nodesMarkup(node.children, ground));
      parts.push('</g>');
      continue;
    }
    parts.push(shapeMarkup(node, ground));
  }
  return parts;
}

export interface RenderOptions {
  /** Which half of every colour pair to paint. */
  ground: Ground;
  /**
   * Draw the artboard's own background. Off for targets that want
   * transparency — a monochrome mask, an SVG favicon meant to sit on a page.
   */
  background?: boolean;
}

export function renderSvg(doc: IconDoc, options: RenderOptions): string {
  const { ground, background = true } = options;
  const { width, height } = doc.artboard;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}">`,
  ];
  if (background) {
    parts.push(
      `<rect x="0" y="0" width="${n(width)}" height="${n(height)}" fill="${escapeAttribute(doc.background[ground])}"/>`,
    );
  }
  // Document order is front-to-back; SVG paints in source order, so the list
  // is reversed to put the frontmost object last.
  parts.push(...nodesMarkup(doc.objects, ground));
  parts.push('</svg>');
  return parts.join('');
}
