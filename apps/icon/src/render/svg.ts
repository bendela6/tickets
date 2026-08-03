import { bounds, centreOf, isOpenRun, rotatedBounds, type Box } from '../doc/geometry';
import { isGroup, placementOf } from '../doc/tree';
import type {
  Ground,
  IconDoc,
  IconGroup,
  IconNode,
  IconObject,
  Material,
  PathSegment,
} from '../doc/types';

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
 * The same argument is why the materials below are spelled out here rather than
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

/* ── materials ──────────────────────────────────────────────────────────── */

/**
 * What a render is emitting into: which half of every pair, and the key every
 * generated id is built on.
 *
 * `defs` is filled *by* the body rather than worked out beside it, so what ends
 * up in `<defs>` is exactly what something referenced — a filter for a shape
 * that turned out to be hidden, or a clip for a glass shape with nothing under
 * it, is dead weight in every exported file, and there is one file per size per
 * target.
 */
interface Emit {
  ground: Ground;
  key: string;
  /** Keyed by id, so a shape drawn twice defines its filter once. */
  defs: Map<string, string[]>;
}

/**
 * The ids a material needs, derived from the shape's own id and the document's
 * key.
 *
 * The shape's id is what makes two shapes in one document distinct; the key is
 * what makes two *documents* on one page distinct, which matters because both
 * halves of a `<defs>` are global to whatever DOM the markup is inlined into
 * and `rect-1` is a name almost every document has. The key is a fingerprint of
 * the markup the document produces, which gets both properties at once: the
 * same document always emits the same ids, and two different documents can only
 * share a key by emitting byte-identical filters — in which case sharing one is
 * not a collision at all, it is the same definition written once.
 */
const filterId = (emit: Emit, object: IconObject): string => `m-${emit.key}-${object.id}`;
const backdropId = (emit: Emit, object: IconObject): string => `b-${emit.key}-${object.id}`;
const clipId = (emit: Emit, object: IconObject): string => `c-${emit.key}-${object.id}`;

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

/**
 * The shape's own measurements, as a material reads them.
 *
 * Every number a material is drawn with is a fraction of these rather than a
 * length, and that is the one property a material has to have: the same
 * document is exported at 16 pixels and at 1024 from this same markup, so a rim
 * quoted in document units would be a hairline on one and a border on the
 * other.
 */
interface Size {
  /** The shape's own box, in the coordinates the shape itself is stated in. */
  box: Box;
  /** Floored by the stroke, because a run has no area and its stroke is all there is. */
  w: number;
  h: number;
  /** The shorter side — what a rim, a blur and a grain are all measured against. */
  span: number;
}

function sizeOf(object: IconObject): Size {
  const box = bounds(object);
  const w = Math.max(box.w, object.strokeWidth, 1);
  const h = Math.max(box.h, object.strokeWidth, 1);
  return { box, w, h, span: Math.min(w, h) };
}

/**
 * One material as its filter primitives, and how far outside the shape it
 * paints.
 *
 * `spread` is a fraction of the shorter side. Everything but the glow stays
 * inside the outline, so it buys only enough room for a wide stroke and the
 * softest blur to finish.
 */
interface Pass {
  spread: number;
  primitives: string[];
}

/** White, at the strength each highlight is worth. Never a colour of its own. */
const LIT = '#FFFFFF';

/**
 * An inner shadow, as the three primitives that make one: the alpha moved,
 * softened, and then subtracted from the alpha it came from — which leaves a
 * band inside the edge the light does not reach.
 *
 * `drop` is signed, and its sign is the whole statement about where the light
 * is. Positive falls down the shape, darkening inside its top edge, which is
 * what an inset surface does. Negative shades inside the bottom, which is what
 * a slab lit from above does — and is why glass and matte pass different signs.
 */
function innerShade(size: Size, drop: number, blur: number, strength: number): string[] {
  return [
    `<feOffset in="SourceAlpha" dy="${n(size.h * drop)}" result="fall"/>`,
    `<feGaussianBlur in="fall" stdDeviation="${n(size.span * blur)}" result="haze"/>`,
    `<feComposite in="SourceAlpha" in2="haze" operator="out" result="hollow"/>`,
    `<feComponentTransfer in="hollow" result="shade">`,
    `${INDENT}<feFuncA type="linear" slope="${n(strength)}"/>`,
    `</feComponentTransfer>`,
  ];
}

/**
 * The whole outline as a band of its own, `rim` thick. Eroding the alpha and
 * subtracting the core follows whatever outline the shape actually has — a
 * circle's rim curves and a hexagon's does not — where a drawn frame would have
 * to know the shape's corners.
 */
function outlineRim(size: Size, rim: number): string[] {
  return [
    `<feMorphology in="SourceAlpha" operator="erode" radius="${n(size.span * rim)}" result="core"/>`,
    `<feComposite in="SourceAlpha" in2="core" operator="out" result="crest"/>`,
  ];
}

/**
 * The top `depth` of that rim, and nothing below it.
 *
 * Kept by intersecting the rim with a copy of the shape lifted until only its
 * upper part still overlaps, which is the same trick the gloss cap uses: a cut
 * made from the shape rather than from a straight line, so a curved shape's lit
 * edge fades out where the outline turns away.
 */
function topRim(size: Size, rim: number, depth: number): string[] {
  return [
    `<feMorphology in="SourceAlpha" operator="erode" radius="${n(size.span * rim)}" result="core"/>`,
    `<feComposite in="SourceAlpha" in2="core" operator="out" result="edge"/>`,
    `<feOffset in="SourceAlpha" dy="${n(-size.h * (1 - depth))}" result="lift"/>`,
    `<feComposite in="edge" in2="lift" operator="in" result="crest"/>`,
  ];
}

/** A flood of `colour` cut to the alpha of `mask`. */
function tint(colour: string, alpha: number, mask: string, result: string): string[] {
  return [
    `<feFlood flood-color="${escapeAttribute(colour)}" flood-opacity="${n(alpha)}" result="${result}Ink"/>`,
    `<feComposite in="${result}Ink" in2="${mask}" operator="in" result="${result}"/>`,
  ];
}

function merge(...layers: string[]): string[] {
  return [
    '<feMerge>',
    ...layers.map((layer) => `${INDENT}<feMergeNode in="${layer}"/>`),
    '</feMerge>',
  ];
}

/**
 * Glass: a translucent body with the layers beneath it blurred through, a lit
 * rim along the top edge and a soft shading inside the bottom.
 *
 * The body is thinned by a transfer rather than by writing a smaller `opacity`
 * on the shape, because the shape's own opacity is the user's and stays theirs
 * — a material adds passes, it does not edit the document.
 *
 * The blurred backdrop is not here. SVG cannot sample what is behind an
 * element, so the renderer paints the layers beneath a second time, clipped to
 * this shape's outline, as a sibling immediately below it — see `paintedMarkup`.
 * Refraction was considered and dropped: `feDisplacementMap` doubles the filter
 * cost and turns to mush below about 32 pixels, which is most of what an icon
 * is exported at.
 */
function glassPasses(size: Size): Pass {
  return {
    spread: 0.06,
    primitives: [
      '<feComponentTransfer in="SourceGraphic" result="body">',
      `${INDENT}<feFuncA type="linear" slope="0.44"/>`,
      '</feComponentTransfer>',
      // One light, stated twice: the rim it lights is at the top, so the band
      // it cannot reach is at the bottom.
      ...innerShade(size, -0.08, 0.05, 0.42),
      ...topRim(size, 0.022, 0.3),
      ...tint(LIT, 0.9, 'crest', 'lit'),
      ...merge('body', 'shade', 'lit'),
    ],
  };
}

/**
 * Glossy: a hard specular cap over the upper third of a saturated body, and a
 * soft bounce along the bottom.
 *
 * The cap is barely blurred on purpose. A gloss is a *reflection* of something
 * with an edge, and softening it until the edge is gone is what turns a glossy
 * button into a gradient — and a gradient is the first thing to disappear at
 * 16 pixels, which this has to survive.
 */
function glossyPasses(size: Size): Pass {
  return {
    spread: 0.06,
    primitives: [
      `<feColorMatrix in="SourceGraphic" type="saturate" values="1.35" result="body"/>`,
      `<feOffset in="SourceAlpha" dy="${n(-size.h * 0.64)}" result="raise"/>`,
      `<feComposite in="raise" in2="SourceAlpha" operator="in" result="capA"/>`,
      `<feGaussianBlur in="capA" stdDeviation="${n(size.span * 0.012)}" result="cap"/>`,
      ...tint(LIT, 0.44, 'cap', 'spec'),
      `<feOffset in="SourceAlpha" dy="${n(size.h * 0.74)}" result="sink"/>`,
      `<feComposite in="sink" in2="SourceAlpha" operator="in" result="footA"/>`,
      `<feGaussianBlur in="footA" stdDeviation="${n(size.span * 0.08)}" result="foot"/>`,
      ...tint(LIT, 0.2, 'foot', 'bounce'),
      ...merge('body', 'bounce', 'spec'),
    ],
  };
}

/**
 * Metal: fine streaks running across the surface, one sheen band turned away
 * from centre, and a bright edge.
 *
 * The streaks are what makes it anisotropic — noise with a low frequency along
 * one axis and a high one along the other, which is a brushed finish and not a
 * texture. The band sits above centre rather than on it because a sheen on the
 * midline reads as a fold.
 */
function metalPasses(size: Size): Pass {
  return {
    spread: 0.06,
    primitives: [
      `<feTurbulence type="fractalNoise" baseFrequency="${n(5 / size.w)} ${n(150 / size.h)}" numOctaves="1" seed="5" result="fibre"/>`,
      `<feColorMatrix in="fibre" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.55 0 0 0 -0.34" result="streak"/>`,
      `<feComposite in="streak" in2="SourceAlpha" operator="in" result="brush"/>`,
      `<feOffset in="SourceAlpha" dy="${n(-size.h * 0.6)}" result="over"/>`,
      `<feOffset in="SourceAlpha" dy="${n(size.h * 0.24)}" result="under"/>`,
      `<feComposite in="over" in2="under" operator="in" result="bandA"/>`,
      `<feComposite in="bandA" in2="SourceAlpha" operator="in" result="bandB"/>`,
      `<feGaussianBlur in="bandB" stdDeviation="${n(size.span * 0.045)}" result="band"/>`,
      ...tint(LIT, 0.5, 'band', 'sheen'),
      ...outlineRim(size, 0.022),
      ...tint(LIT, 0.62, 'crest', 'bright'),
      ...merge('SourceGraphic', 'brush', 'sheen', 'bright'),
    ],
  };
}

/**
 * Matte: the body as it is, with a soft inner shadow. Nearly free — four
 * primitives, none of them noise — which is what makes it the one to reach for
 * when a mark has a dozen shapes in it.
 */
function mattePasses(size: Size): Pass {
  return {
    spread: 0.06,
    primitives: [...innerShade(size, 0.11, 0.075, 0.55), ...merge('SourceGraphic', 'shade')],
  };
}

/**
 * Paper: matte, plus grain.
 *
 * Two specks off one turbulence rather than one, because a fill can be either
 * half of a pair: dark grain alone is invisible on a dark mark, and light grain
 * alone is invisible on a light one. Both are cut from the same noise, so they
 * interleave rather than fight.
 *
 * The frequency is a count across the shape rather than a constant, so the
 * grain is the same fineness on a 16-unit glyph as on a 1024-unit mark.
 */
function paperPasses(size: Size): Pass {
  const frequency = 150 / size.span;
  return {
    spread: 0.06,
    primitives: [
      ...innerShade(size, 0.11, 0.075, 0.45),
      `<feTurbulence type="fractalNoise" baseFrequency="${n(frequency)}" numOctaves="2" seed="11" result="fibre"/>`,
      `<feColorMatrix in="fibre" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0 0 0 -0.3" result="darkA"/>`,
      `<feComposite in="darkA" in2="SourceAlpha" operator="in" result="dark"/>`,
      `<feColorMatrix in="fibre" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -0.5 0 0 0 0.2" result="paleA"/>`,
      `<feComposite in="paleA" in2="SourceAlpha" operator="in" result="pale"/>`,
      ...merge('SourceGraphic', 'shade', 'dark', 'pale'),
    ],
  };
}

/**
 * Glow: an emissive edge over an outer bloom, in the shape's own colour.
 *
 * The colour is read off the pair rather than invented, which is what lets the
 * dark half burn brighter than the light one: a mark whose dark colour is a
 * pale lilac glows pale lilac on a dark ground, and the same object glows deep
 * indigo on a white one. A fixed glow colour would be a third colour on an
 * object that has exactly two.
 *
 * The bloom is merged twice. Two passes of the same translucent flood compound
 * into something that reads as *lit* rather than as blurred, which one pass at
 * twice the opacity does not.
 */
function glowPasses(size: Size, colour: string): Pass {
  return {
    // The only material that paints outside the shape, so the only one that
    // needs a region much bigger than it.
    spread: 0.55,
    primitives: [
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(size.span * 0.15)}" result="haze"/>`,
      ...tint(colour, 0.8, 'haze', 'bloom'),
      ...outlineRim(size, 0.02),
      ...tint(LIT, 0.7, 'crest', 'rim'),
      ...merge('bloom', 'bloom', 'SourceGraphic', 'rim'),
    ],
  };
}

function passesFor(material: Material, object: IconObject, ground: Ground): Pass {
  const size = sizeOf(object);
  switch (material) {
    case 'glass':
      return glassPasses(size);
    case 'glossy':
      return glossyPasses(size);
    case 'metal':
      return metalPasses(size);
    case 'matte':
      return mattePasses(size);
    case 'paper':
      return paperPasses(size);
    case 'glow':
      return glowPasses(size, colourFor(object, ground));
  }
}

/**
 * The region a filter is allowed to paint in, in the shape's own units.
 *
 * `filterUnits="userSpaceOnUse"` rather than the percentages of the bounding
 * box SVG defaults to, and both reasons end in a blank export. The default
 * region is 110% of the *fill* box, which clips a wide stroke off every
 * filtered shape. And a horizontal line's box has no height at all, so a region
 * stated as a percentage of it is empty and the shape vanishes outright.
 */
function regionOf(object: IconObject, spread: number): string {
  const size = sizeOf(object);
  const pad = object.strokeWidth + size.span * spread;
  const box = size.box;
  return ` filterUnits="userSpaceOnUse" x="${n(box.x - pad)}" y="${n(box.y - pad)}" width="${n(box.w + pad * 2)}" height="${n(box.h + pad * 2)}"`;
}

/** One `<filter>`, its primitives one per line and indented inside it. */
function filterMarkup(id: string, region: string, primitives: readonly string[]): string[] {
  return [
    `<filter id="${id}"${region}>`,
    ...primitives.map((line) => INDENT + line),
    '</filter>',
  ];
}

/**
 * Whether a glass shape has an interior for anything to be seen through.
 *
 * A run — a line, a chevron, an unclosed path — encloses nothing, so a clip
 * taken from it is empty and a backdrop copy would be invisible work in every
 * exported file. Its filter still applies to the stroke, which is the part of
 * it there is.
 */
const seesThrough = (object: IconObject): boolean =>
  object.material === 'glass' && !isOpenRun(object.geometry);

function shapeMarkup(object: IconObject, emit: Emit): string {
  const g = object.geometry;
  const ground = emit.ground;
  const colour = escapeAttribute(colourFor(object, ground));
  const tail = `${strokeAttributes(object, ground)}${opacityOf(object)}${transformOf(object)}${materialAttribute(object, emit)}`;

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
 * The reference that puts a material on a shape, and the definition it needs.
 *
 * Written here, as the shape is drawn, rather than by a second pass over the
 * document: a filter exists in the file exactly when something in the file
 * points at it.
 */
function materialAttribute(object: IconObject, emit: Emit): string {
  const material = object.material;
  if (material === undefined) return '';
  const id = filterId(emit, object);
  if (!emit.defs.has(id)) {
    const pass = passesFor(material, object, emit.ground);
    emit.defs.set(id, filterMarkup(id, regionOf(object, pass.spread), pass.primitives));
  }
  return ` filter="url(#${id})"`;
}

/**
 * The shape as a clip outline: its geometry and its turn, and none of its paint.
 *
 * A `<clipPath>` uses the raw geometry of its children and ignores what they
 * are painted with — but "ignores" is a promise made about fill and stroke, and
 * a filter is neither. Handing the clip a copy that carries no material at all
 * means no browser has to be trusted to drop one.
 */
function outlineMarkup(object: IconObject, emit: Emit): string {
  return shapeMarkup({ ...object, opacity: 100, material: undefined }, emit);
}

/** How much of the shorter side a glass shape blurs what is behind it by. */
const BACKDROP_BLUR = 0.07;

/**
 * What a backdrop copy is wrapped in: blurred, then cut to the glass shape.
 *
 * In that order, and not by accident — an element is filtered before it is
 * clipped, so the blur is free to smear and the clip then takes the shape's
 * outline out of it with a hard edge. Clipping first would blur the cut.
 */
function backdropAttributes(object: IconObject, emit: Emit): string {
  const clip = clipId(emit, object);
  const blur = backdropId(emit, object);
  if (!emit.defs.has(clip)) {
    emit.defs.set(clip, [
      `<clipPath id="${clip}">`,
      INDENT + outlineMarkup(object, emit),
      '</clipPath>',
    ]);
  }
  if (!emit.defs.has(blur)) {
    const deviation = sizeOf(object).span * BACKDROP_BLUR;
    // The region is the glass shape's own footprint and no more: everything
    // outside the clip is thrown away, so blurring it would be work nobody can
    // see. Turned, because the clip is. Padded by three deviations, which is
    // where a gaussian has nothing left to contribute.
    const box = rotatedBounds(object);
    const pad = deviation * 3;
    emit.defs.set(blur, [
      `<filter id="${blur}" filterUnits="userSpaceOnUse" x="${n(box.x - pad)}" y="${n(box.y - pad)}" width="${n(box.w + pad * 2)}" height="${n(box.h + pad * 2)}">`,
      `${INDENT}<feGaussianBlur stdDeviation="${n(deviation)}"/>`,
      '</filter>',
    ]);
  }
  return ` clip-path="url(#${clip})" filter="url(#${blur})"`;
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
 *
 * **A glass shape is preceded by a copy of what is beneath it.** SVG cannot
 * sample what is behind an element — `BackgroundImage` was specified and never
 * implemented anywhere — so the only honest way to see through something is to
 * draw what is behind it a second time, blurred, and cut to its outline. The
 * copy goes immediately below the shape *in the same list*, which is what makes
 * it exact: the layers are re-emitted with the very coordinates they already
 * had, in the very frame the clip is stated in, so nothing has to be pushed
 * through a transform on the way.
 *
 * "Beneath" is therefore beneath in that list. At the top level, which is where
 * a glass shape almost always is, that is everything under it in the document.
 * Inside a group it is the group's own layers, and reaching outside one would
 * mean reading every other shape back through the inverse of the group's frame
 * — a second, approximate spelling of coordinates the model already states
 * exactly.
 *
 * `copies` is how a copy is stopped from making copies of its own. Glass over
 * glass would otherwise grow the file exponentially in the number of stacked
 * glass shapes, to show a blur through a blur — a difference nobody can see and
 * every exported file pays for.
 */
function paintedMarkup(
  painted: readonly IconNode[],
  emit: Emit,
  depth: number,
  copies: boolean,
): string[] {
  const pad = INDENT.repeat(depth);
  const parts: string[] = [];
  for (let index = 0; index < painted.length; index += 1) {
    const node = painted[index];
    if (node === undefined || node.hidden) continue;
    if (isGroup(node)) {
      parts.push(`${pad}<g${transformOfGroup(node)}${opacityOf(node)}>`);
      parts.push(...paintedMarkup(paintOrder(node.children), emit, depth + 1, copies));
      parts.push(`${pad}</g>`);
      continue;
    }
    if (copies && seesThrough(node)) {
      const beneath = painted.slice(0, index).filter((under) => !under.hidden);
      // Nothing under it is not a case to defend against, it is a case with an
      // answer: there is no backdrop, so no copy is written.
      if (beneath.length > 0) {
        parts.push(`${pad}<g${backdropAttributes(node, emit)}>`);
        parts.push(...paintedMarkup(beneath, emit, depth + 1, false));
        parts.push(`${pad}</g>`);
      }
    }
    parts.push(pad + shapeMarkup(node, emit));
  }
  return parts;
}

/** Whether anything drawn in the tree wears a material. */
function anyMaterial(nodes: readonly IconNode[]): boolean {
  return nodes.some((node) => {
    if (node.hidden) return false;
    return isGroup(node) ? anyMaterial(node.children) : node.material !== undefined;
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
  const body = paintedMarkup(paintOrder(doc.objects), emit, 1, true);
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
  // A document with nothing wearing a material generates no ids at all, so it
  // needs no key and is composed once — and what it produces is byte for byte
  // the file this renderer has always produced.
  if (!anyMaterial(doc.objects)) return compose(doc, ground, background, '');
  // Two passes, because the key is a fingerprint of the markup and the markup
  // carries the key. The draft is discarded and only its digest kept, so the
  // key is a function of the document alone: the same document always
  // fingerprints to the same string, and two documents can only fingerprint
  // alike by emitting the same filters, which is not a collision.
  return compose(doc, ground, background, fingerprint(compose(doc, ground, background, DRAFT_KEY)));
}
