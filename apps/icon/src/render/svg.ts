import { bounds, centreOf, isOpenRun, type Box } from '../doc/geometry';
import { contentBox, isGroup, placementOf } from '../doc/tree';
import type { Ground, IconDoc, IconGroup, IconNode, IconObject, PathSegment } from '../doc/types';

/**
 * The document as SVG. This is the only place artwork is drawn for export —
 * every raster target rasterises this string, so a shape can never look
 * different in a PNG than it does on screen.
 *
 * Output is deterministic: fixed attribute order, fixed number formatting, and
 * ids that are a function of the document rather than of a counter. That is
 * what lets a test compare two renders directly.
 *
 * Everything is self-contained. No external reference, no stylesheet, nothing
 * that depends on the page the markup lands in — because the export draws this
 * string through an `<img>` onto a canvas, which is an isolated context that
 * would fetch none of it.
 *
 * It is also laid out to be read: one element per line, nesting indented. An
 * exported `.svg` is a file somebody opens in an editor and reads in a diff,
 * and a single 4kB line is neither. The layout is part of the output rather
 * than something a viewer applies afterwards — a prettifier anywhere else would
 * be a second spelling of the same document, and this file is the only one.
 * The same argument is why the filters below are spelled out here rather than
 * in a module of their own: a filter is markup, and markup has one author.
 */

/** One level of nesting. */
const INDENT = '  ';

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

/* ── effects ────────────────────────────────────────────────────────────── */

/**
 * What a render is emitting into: which half of every pair, and the key every
 * generated id is built on.
 *
 * `defs` is filled *by* the body rather than worked out beside it, so what ends
 * up in `<defs>` is exactly what something referenced — a filter for a node
 * that turned out to be hidden is dead weight in every exported file, and there
 * is one file per size per target.
 */
interface Emit {
  ground: Ground;
  key: string;
  /** Keyed by id, so a node drawn twice defines its filter once. */
  defs: Map<string, string[]>;
}

/**
 * The id a node's filter is written under, from the node's own id and the
 * document's key.
 *
 * The node's id is what makes two objects in one document distinct; the key is
 * what makes two *documents* on one page distinct, which matters because a
 * `<defs>` is global to whatever DOM the markup is inlined into and `rect-1` is
 * a name almost every document has. The key is a fingerprint of the markup the
 * document produces, which gets both properties at once: the same document
 * always emits the same ids, and two different documents can only share a key
 * by emitting byte-identical filters — in which case sharing one is not a
 * collision at all, it is the same definition written once.
 */
const filterId = (emit: Emit, node: IconNode): string => `fx-${emit.key}-${node.id}`;

/**
 * A 32-bit FNV-1a of the draft markup, in base 36.
 *
 * Short because it is read: it lands in every filter reference the source panel
 * shows, and a 32-character digest would drown the markup it is labelling.
 */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Whether anything at all is asked of this node's filter. */
const hasEffect = (node: IconNode): boolean =>
  (node.blur ?? 0) > 0 || node.shadow !== undefined;

/** Where a gaussian has nothing left to give: three deviations holds 99.7% of one. */
const TAILS = 3;

/**
 * The widest outline anything in this list is drawn with, in the list's own
 * frame — scaled through every group in between, because a stroke inside a
 * group scaled by 3 is painted three units wide for every one it states.
 */
function strokeReach(nodes: readonly IconNode[], scale = 1): number {
  return nodes.reduce(
    (widest, node) =>
      isGroup(node)
        ? Math.max(widest, strokeReach(node.children, scale * placementOf(node).scale))
        : Math.max(widest, node.strokeWidth * scale),
    0,
  );
}

/**
 * The region a filter is allowed to paint in, in the node's own units.
 *
 * `filterUnits="userSpaceOnUse"` rather than the percentages of the bounding
 * box SVG defaults to, and every reason ends in a spoiled export. The default
 * region is 110% of the *fill* box, which is nowhere near a shadow and clips a
 * wide stroke off every filtered shape; a horizontal line's box has no height
 * at all, so a percentage of it is empty and the shape vanishes outright. It
 * also resolves *inside* the element's own `transform`, which is what makes a
 * turned shape's region its upright box and a group's its content box — neither
 * has to be pushed through a transform to get here, and it is why a shadow's
 * offset turns with the shape it belongs to.
 *
 * The four numbers come from the actual offset and radii rather than from a
 * fixed margin. A shadow thrown 20 units with a 10-unit radius lands 20 + 30
 * units past the outline it came from, and a region that does not cover it
 * crops the shadow with a straight edge partway along — a failure invisible at
 * small offsets and obvious at large ones, which is the worst way to be wrong.
 * Stated per side, because a shadow falling downwards needs no room above the
 * shape and every unit of region is surface a rasteriser fills at every size.
 */
function regionOf(node: IconNode): string {
  const box: Box = isGroup(node) ? contentBox(node) : bounds(node);
  // `bounds` and `contentBox` both state the fill box for anything that has
  // one, and a stroke is painted centred on the outline — so half of the widest
  // stroke involved hangs outside them.
  const outward = (isGroup(node) ? strokeReach(node.children) : node.strokeWidth) / 2;
  const soft = (node.blur ?? 0) * TAILS + outward;
  const shadow = node.shadow;
  // The shadow is thrown from the already-blurred shape, so both radii are
  // behind it; `towards` is how far it carries on the side it is heading for.
  const towards = (offset: number): number =>
    shadow === undefined ? soft : Math.max(soft, soft + shadow.blur * TAILS + offset);
  const left = towards(-(shadow?.dx ?? 0));
  const right = towards(shadow?.dx ?? 0);
  const top = towards(-(shadow?.dy ?? 0));
  const bottom = towards(shadow?.dy ?? 0);
  return ` filterUnits="userSpaceOnUse" x="${n(box.x - left)}" y="${n(box.y - top)}" width="${n(box.w + left + right)}" height="${n(box.h + top + bottom)}"`;
}

/**
 * The two primitives an object's effects come to.
 *
 * **Blur first, shadow second.** A blurred shape throws a blurred shadow — what
 * stops the light is whatever the object has become, not the crisp thing it
 * started as — so `feDropShadow` reads the softened result rather than the
 * source. The `in` is written out rather than left to the spec's "whatever the
 * previous primitive produced" default, because that order is the whole
 * statement and an exported file should say it out loud.
 *
 * `feDropShadow` rather than an offset-blur-flood-merge run assembled here: the
 * spec defines it as exactly that run, so writing one out would be five lines
 * saying what one says, with five more chances to mis-wire an `in`. It also
 * carries the source through on top of the shadow itself, which is what keeps
 * the object drawn over its own shadow rather than under it.
 */
function effectPrimitives(node: IconNode, ground: Ground): string[] {
  const blur = node.blur ?? 0;
  const shadow = node.shadow;
  const lines: string[] = [];
  if (blur > 0) {
    // Named only when the next primitive needs to name it back.
    const held = shadow === undefined ? '' : ' result="soft"';
    lines.push(`<feGaussianBlur stdDeviation="${n(blur)}"${held}/>`);
  }
  if (shadow !== undefined) {
    const from = blur > 0 ? ' in="soft"' : '';
    lines.push(
      `<feDropShadow${from} dx="${n(shadow.dx)}" dy="${n(shadow.dy)}" stdDeviation="${n(shadow.blur)}" flood-color="${escapeAttribute(shadow.colour[ground])}" flood-opacity="${n(shadow.opacity / 100)}"/>`,
    );
  }
  return lines;
}

/**
 * The reference that puts an object's effects on it, and the `<filter>` it
 * needs, one primitive per line and indented inside it.
 *
 * Written here, as the object is drawn, rather than by a second pass over the
 * document: a filter exists in the file exactly when something in the file
 * points at it.
 *
 * The object's own `opacity` is deliberately left where it already is, on the
 * element beside this. SVG applies a filter before opacity, so the shape and
 * the shadow it throws fade together as one thing — and the shadow does not
 * come glowing through the half-transparent shape that cast it, which is what
 * fading them separately would look like.
 */
function filterAttribute(node: IconNode, emit: Emit): string {
  if (!hasEffect(node)) return '';
  const id = filterId(emit, node);
  if (!emit.defs.has(id)) {
    emit.defs.set(id, [
      `<filter id="${id}"${regionOf(node)}>`,
      ...effectPrimitives(node, emit.ground).map((line) => INDENT + line),
      '</filter>',
    ]);
  }
  return ` filter="url(#${id})"`;
}

function shapeMarkup(object: IconObject, emit: Emit): string {
  const g = object.geometry;
  const ground = emit.ground;
  const colour = escapeAttribute(colourFor(object, ground));
  const tail = `${strokeAttributes(object, ground)}${opacityOf(object)}${transformOf(object)}${filterAttribute(object, emit)}`;

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
      // enclose. The joins are curved because its corners are its own.
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

/** A list stated front-to-back, in the order SVG paints it. */
const paintOrder = (nodes: readonly IconNode[]): IconNode[] => [...nodes].reverse();

/**
 * One list of nodes, painted back to front.
 *
 * The list is reversed at every level and not only at the top: front-to-back is
 * a property of a list of objects, and a group holds one of those.
 *
 * A hidden group is skipped whole, children and all — which is the model's
 * "hidden propagates down" and costs nothing to say here, because a `<g>` that
 * is not emitted cannot emit anything inside it.
 *
 * Each line arrives already indented for `depth`, so nesting is stated by the
 * one recursion that knows how deep it is rather than by a second pass over
 * finished markup.
 */
function paintedMarkup(painted: readonly IconNode[], emit: Emit, depth: number): string[] {
  const pad = INDENT.repeat(depth);
  const parts: string[] = [];
  for (const node of painted) {
    if (node.hidden) continue;
    if (isGroup(node)) {
      parts.push(`${pad}<g${transformOfGroup(node)}${opacityOf(node)}${filterAttribute(node, emit)}>`);
      parts.push(...paintedMarkup(paintOrder(node.children), emit, depth + 1));
      parts.push(`${pad}</g>`);
      continue;
    }
    parts.push(pad + shapeMarkup(node, emit));
  }
  return parts;
}

/** Whether anything drawn in the tree asks for a filter. */
function anyEffect(nodes: readonly IconNode[]): boolean {
  return nodes.some((node) => {
    if (node.hidden) return false;
    return hasEffect(node) || (isGroup(node) && anyEffect(node.children));
  });
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

/**
 * The whole file, given the key its generated ids are built on.
 *
 * The body is composed before the head, because `<defs>` is written out of what
 * the body turned out to reference rather than out of a survey of the document.
 */
function compose(doc: IconDoc, ground: Ground, background: boolean, key: string): string {
  const emit: Emit = { ground, key, defs: new Map() };
  // Document order is front-to-back; SVG paints in source order, so the list
  // is reversed to put the frontmost object last.
  const body = paintedMarkup(paintOrder(doc.objects), emit, 1);
  const { width, height } = doc.artboard;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}">`,
  ];
  if (emit.defs.size > 0) {
    parts.push(`${INDENT}<defs>`);
    for (const lines of emit.defs.values()) {
      for (const line of lines) parts.push(INDENT.repeat(2) + line);
    }
    parts.push(`${INDENT}</defs>`);
  }
  if (background) {
    parts.push(
      `${INDENT}<rect x="0" y="0" width="${n(width)}" height="${n(height)}" fill="${escapeAttribute(doc.background[ground])}"/>`,
    );
  }
  parts.push(...body);
  parts.push('</svg>');
  // No trailing newline: the string is the file, and it is also what the source
  // panel shows and what the copy control puts on the clipboard — a blank last
  // line would be a character nobody asked for in all three.
  return parts.join('\n');
}

/**
 * The key the draft pass is composed with. Any fixed string does: it is thrown
 * away with the draft, and only the digest of that draft survives.
 */
const DRAFT_KEY = '0';

export function renderSvg(doc: IconDoc, options: RenderOptions): string {
  const { ground, background = true } = options;
  // A document where nothing asks for a filter generates no ids at all, so it
  // needs no key and is composed once — and what it produces is byte for byte
  // the file this renderer has always produced.
  if (!anyEffect(doc.objects)) return compose(doc, ground, background, '');
  // Two passes, because the key is a fingerprint of the markup and the markup
  // carries the key. The draft is discarded and only its digest kept, so the
  // key is a function of the document alone: the same document always
  // fingerprints to the same string, and two documents can only fingerprint
  // alike by emitting the same filters, which is not a collision.
  return compose(doc, ground, background, fingerprint(compose(doc, ground, background, DRAFT_KEY)));
}
