import type { PathSegment, Point } from '../doc/types';
import { parseDeclarations } from './css';

/**
 * SVG text in, data out.
 *
 * Nothing in this file knows what a document is. It answers only "what does
 * this file say" — the tree, the numbers, the matrices, the colours — and
 * `map.ts` answers "what of that can we keep". The split is what lets the
 * grammar be tested on its own, which matters because the grammar is where an
 * importer is usually wrong: SVG writes every command relative as well as
 * absolute, packs numbers without separators, and lets a sign be one.
 *
 * The XML itself is the browser's `DOMParser`. A hand-rolled XML reader would
 * be a second thing to get wrong, and a dependency would be the first this app
 * has.
 */

/** An element with its attributes resolved — inline style already folded in. */
export interface SvgNode {
  /**
   * The local name exactly as written. SVG is case-sensitive, so `clipPath`
   * stays `clipPath`: lowercasing it would let `<clippath>` — which no renderer
   * honours — through as though it were the real thing.
   */
  tag: string;
  attrs: Readonly<Record<string, string>>;
  children: SvgNode[];
}

export type ParseOutcome =
  | {
      ok: true;
      root: SvgNode;
      /** The text of every `<style>` block, in source order. */
      css: string[];
    }
  | { ok: false; message: string };

function attributesOf(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attribute = element.attributes.item(i);
    if (attribute) attrs[attribute.name] = attribute.value;
  }
  // Inline style beats the presentation attribute of the same name, which is
  // the cascade's own rule. Drawing tools lean on it — a `fill` left over from
  // a template with a `style` that overrides it is one file, not a broken one.
  // What a `<style>` block says ranks between the two, and is folded in later:
  // only there is the whole file available to work out which rule won.
  const style = attrs['style'];
  if (style !== undefined) Object.assign(attrs, parseDeclarations(style));
  return attrs;
}

function nodeOf(element: Element): SvgNode {
  const children: SvgNode[] = [];
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children.item(i);
    if (child) children.push(nodeOf(child));
  }
  return { tag: element.localName, attrs: attributesOf(element), children };
}

/** The first line of a parser's complaint, short enough to read in a dialog. */
function firstLine(text: string | null): string {
  const line = (text ?? '').split('\n')[0]?.trim() ?? '';
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

/**
 * The file as a tree, or the reason it is not one.
 *
 * A failure comes back as a value rather than an exception: every caller has a
 * report to put it in, and a thrown parse error would have to be caught at each
 * of them to say the same thing.
 */
export function parseSvg(text: string): ParseOutcome {
  if (text.trim() === '') return { ok: false, message: 'the file is empty' };
  if (typeof DOMParser === 'undefined') {
    return { ok: false, message: 'this browser has no XML parser' };
  }
  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
  const failure = parsed.querySelector('parsererror');
  if (failure) {
    const detail = firstLine(failure.textContent);
    return {
      ok: false,
      message: detail ? `not well-formed XML — ${detail}` : 'not well-formed XML',
    };
  }
  const root: Element | null = parsed.documentElement;
  if (!root || root.localName !== 'svg') {
    return {
      ok: false,
      message: `the root element is <${root?.localName ?? 'nothing'}> rather than <svg>`,
    };
  }
  // Taken off the document rather than out of the tree above, which holds
  // elements and not the text inside them — and taken from wherever it sits,
  // because a stylesheet tucked into `<defs>` styles the file just the same.
  const css: string[] = [];
  const blocks = parsed.getElementsByTagName('style');
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks.item(i)?.textContent;
    if (block !== null && block !== undefined) css.push(block);
  }
  return { ok: true, root: nodeOf(root), css };
}

/**
 * A number as SVG writes one: an optional sign, digits either side of an
 * optional point, an optional exponent. Sticky, so it can be walked along a
 * string a token at a time rather than split by a separator that may not exist.
 */
const NUMBER = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/y;
const SEPARATOR = /[\s,]/;

/**
 * A reader over a number list.
 *
 * SVG's number lists are not separated so much as they are merely delimited
 * where they have to be: `M0 0L10 10` packs a command against a number, `10-5`
 * is two numbers because a sign cannot appear mid-number, and `a1 1 0 011 1`
 * writes two arc flags as two characters of one token. All three are valid, all
 * three are common in minified files, and a `split` on whitespace loses every
 * one of them.
 */
class Reader {
  private at = 0;

  constructor(private readonly text: string) {}

  private skip(): void {
    while (this.at < this.text.length && SEPARATOR.test(this.text.charAt(this.at))) this.at += 1;
  }

  done(): boolean {
    this.skip();
    return this.at >= this.text.length;
  }

  number(): number | null {
    this.skip();
    NUMBER.lastIndex = this.at;
    const found = NUMBER.exec(this.text);
    if (!found || found.index !== this.at) return null;
    this.at = NUMBER.lastIndex;
    const value = Number(found[0]);
    return Number.isFinite(value) ? value : null;
  }

  /**
   * One arc flag. Exactly one character wide, which is the whole reason it is
   * not read as a number: in `011 1` the first `0` and `1` are the flags and
   * the `1` that follows is the x coordinate.
   */
  flag(): boolean | null {
    this.skip();
    const character = this.text.charAt(this.at);
    if (character !== '0' && character !== '1') return null;
    this.at += 1;
    return character === '1';
  }

  /** The next character if it is a letter, consumed. */
  letter(): string | null {
    this.skip();
    const character = this.text.charAt(this.at);
    if (!/[a-zA-Z]/.test(character)) return null;
    this.at += 1;
    return character;
  }
}

/** Every number in a list — what `points` and a transform's arguments are. */
export function parseNumbers(text: string): number[] {
  const reader = new Reader(text);
  const numbers: number[] = [];
  for (;;) {
    const value = reader.number();
    if (value === null) return numbers;
    numbers.push(value);
  }
}

/**
 * A length attribute — `width`, `height`, `stroke-width`.
 *
 * Absolute units are dropped rather than converted: a document's units are
 * whatever its `viewBox` says they are, so `24px` and `24` mean the same thing
 * inside it. A percentage means nothing without a viewport to be a percentage
 * of, so it comes back as null for the caller to report.
 */
export function parseLength(value: string | undefined): number | null {
  if (value === undefined) return null;
  const text = value.trim();
  if (text === '' || text.endsWith('%')) return null;
  const number = Number(text.replace(/(px|pt|pc|mm|cm|in|em|ex|rem)$/i, '').trim());
  return Number.isFinite(number) ? number : null;
}

export interface PathParse {
  segments: PathSegment[];
  /** What stopped the read, if anything. Whatever parsed first is still here. */
  error: string | null;
}

const COMMANDS = 'MmLlHhVvCcSsQqTtAaZz';

/** The point `control` reflected through `at` — what `S` and `T` are stated as. */
const reflect = (control: Point, at: Point): Point => ({
  x: 2 * at.x - control.x,
  y: 2 * at.y - control.y,
});

/**
 * A `d` attribute as the absolute commands the model stores.
 *
 * Three conversions happen here and nowhere else:
 *
 * - **Relative to absolute.** Every lowercase command is measured from the pen,
 *   so the pen has to be tracked; after a `Z` it sits at the start of the
 *   subpath rather than where the last command left it, and getting that wrong
 *   scatters the rest of the path.
 * - **Shorthand to longhand.** `H`/`V` gain the coordinate they leave out.
 *   `S`/`T` gain the control point they leave out, which is the previous
 *   control reflected through the current point — and *only* when the previous
 *   command was of the matching family. After anything else the reflection is
 *   the current point itself, and a curve drawn with the wrong one kinks
 *   visibly at the join.
 * - **Implicit repetition.** A command letter stays in force until another
 *   arrives, so `M0 0 10 10` is a move and then a line — the repeat of an `M`
 *   is an `L`, which is the one case where the letter changes.
 */
export function parsePathData(d: string): PathParse {
  const reader = new Reader(d);
  const segments: PathSegment[] = [];
  let at: Point = { x: 0, y: 0 };
  let opened: Point = at;
  // The reflectable control of the previous command, per family. Null unless
  // the command immediately before was one that has one.
  let cubicControl: Point | null = null;
  let quadControl: Point | null = null;
  let letter: string | null = null;
  let error: string | null = null;

  const pair = (relative: boolean): Point | null => {
    const x = reader.number();
    const y = reader.number();
    if (x === null || y === null) return null;
    return relative ? { x: at.x + x, y: at.y + y } : { x, y };
  };

  while (!reader.done() && error === null) {
    const next = reader.letter();
    if (next !== null) {
      if (!COMMANDS.includes(next)) {
        error = `"${next}" is not a path command`;
        break;
      }
      letter = next;
    } else if (letter === null) {
      error = 'the path starts with a number rather than a command';
      break;
    } else if (letter === 'M') {
      letter = 'L';
    } else if (letter === 'm') {
      letter = 'l';
    } else if (letter === 'Z' || letter === 'z') {
      error = 'a number follows a closepath';
      break;
    }

    const relative = letter === letter.toLowerCase();
    const upper = letter.toUpperCase();
    let cubic: Point | null = null;
    let quad: Point | null = null;

    switch (upper) {
      case 'M': {
        const point = pair(relative);
        if (!point) {
          error = 'a moveto is missing coordinates';
          break;
        }
        at = point;
        opened = point;
        segments.push({ c: 'M', x: point.x, y: point.y });
        break;
      }
      case 'L': {
        const point = pair(relative);
        if (!point) {
          error = 'a lineto is missing coordinates';
          break;
        }
        at = point;
        segments.push({ c: 'L', x: point.x, y: point.y });
        break;
      }
      case 'H': {
        const x = reader.number();
        if (x === null) {
          error = 'a horizontal lineto is missing its coordinate';
          break;
        }
        at = { x: relative ? at.x + x : x, y: at.y };
        segments.push({ c: 'L', x: at.x, y: at.y });
        break;
      }
      case 'V': {
        const y = reader.number();
        if (y === null) {
          error = 'a vertical lineto is missing its coordinate';
          break;
        }
        at = { x: at.x, y: relative ? at.y + y : y };
        segments.push({ c: 'L', x: at.x, y: at.y });
        break;
      }
      case 'C': {
        const first = pair(relative);
        const second = pair(relative);
        const end = pair(relative);
        if (!first || !second || !end) {
          error = 'a cubic curve is missing coordinates';
          break;
        }
        segments.push({
          c: 'C',
          x1: first.x,
          y1: first.y,
          x2: second.x,
          y2: second.y,
          x: end.x,
          y: end.y,
        });
        at = end;
        cubic = second;
        break;
      }
      case 'S': {
        const second = pair(relative);
        const end = pair(relative);
        if (!second || !end) {
          error = 'a smooth cubic curve is missing coordinates';
          break;
        }
        // Annotated because it feeds the very variable it is read from on the
        // next pass, and an inferred type would chase its own tail.
        const first: Point = cubicControl ? reflect(cubicControl, at) : at;
        segments.push({
          c: 'C',
          x1: first.x,
          y1: first.y,
          x2: second.x,
          y2: second.y,
          x: end.x,
          y: end.y,
        });
        at = end;
        cubic = second;
        break;
      }
      case 'Q': {
        const control = pair(relative);
        const end = pair(relative);
        if (!control || !end) {
          error = 'a quadratic curve is missing coordinates';
          break;
        }
        segments.push({ c: 'Q', x1: control.x, y1: control.y, x: end.x, y: end.y });
        at = end;
        quad = control;
        break;
      }
      case 'T': {
        const end = pair(relative);
        if (!end) {
          error = 'a smooth quadratic curve is missing coordinates';
          break;
        }
        const control: Point = quadControl ? reflect(quadControl, at) : at;
        segments.push({ c: 'Q', x1: control.x, y1: control.y, x: end.x, y: end.y });
        at = end;
        quad = control;
        break;
      }
      case 'A': {
        const rx = reader.number();
        const ry = reader.number();
        const rotation = reader.number();
        const large = reader.flag();
        const sweep = reader.flag();
        const end = pair(relative);
        if (rx === null || ry === null || rotation === null || large === null || sweep === null || !end) {
          error = 'an arc is missing coordinates or flags';
          break;
        }
        segments.push({ c: 'A', rx, ry, rotation, large, sweep, x: end.x, y: end.y });
        at = end;
        break;
      }
      case 'Z': {
        segments.push({ c: 'Z' });
        at = opened;
        break;
      }
      default:
        error = `"${letter}" is not a path command`;
    }

    cubicControl = cubic;
    quadControl = quad;
  }

  return { segments, error };
}

/** A 2D affine transform, in SVG's own `matrix(a b c d e f)` order. */
export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** `m` then `n` — the order a nested transform composes in. */
export function multiply(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function applyMatrix(m: Matrix, point: Point): Point {
  return { x: m.a * point.x + m.c * point.y + m.e, y: m.b * point.x + m.d * point.y + m.f };
}

export const translation = (tx: number, ty: number): Matrix => ({ ...IDENTITY, e: tx, f: ty });

export const scaling = (sx: number, sy: number): Matrix => ({ ...IDENTITY, a: sx, d: sy });

export function rotation(degrees: number): Matrix {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

const TRANSFORM_FUNCTION = /([a-zA-Z]+)\s*\(([^)]*)\)/g;

export interface TransformParse {
  matrix: Matrix;
  /** A function that was not understood, if there was one. */
  error: string | null;
}

/**
 * A `transform` attribute as one matrix.
 *
 * Composed left to right, because that is the order the reader applies them in:
 * `translate(10 0) scale(2)` scales first and then moves, and a list read the
 * other way puts every shape in a file somewhere it is not.
 */
export function parseTransform(text: string): TransformParse {
  let matrix = IDENTITY;
  let error: string | null = null;
  for (const found of text.matchAll(TRANSFORM_FUNCTION)) {
    const name = found[1] ?? '';
    const values = parseNumbers(found[2] ?? '');
    const first = values[0] ?? 0;
    const second = values[1];
    switch (name) {
      case 'matrix': {
        if (values.length < 6) {
          error = 'matrix() needs six numbers';
          break;
        }
        matrix = multiply(matrix, {
          a: values[0] ?? 1,
          b: values[1] ?? 0,
          c: values[2] ?? 0,
          d: values[3] ?? 1,
          e: values[4] ?? 0,
          f: values[5] ?? 0,
        });
        break;
      }
      case 'translate':
        matrix = multiply(matrix, translation(first, second ?? 0));
        break;
      case 'scale':
        matrix = multiply(matrix, scaling(first, second ?? first));
        break;
      case 'rotate': {
        const cx = values[1] ?? 0;
        const cy = values[2] ?? 0;
        // Stated about a point, which is a move out, a turn, and a move back.
        matrix = multiply(
          matrix,
          multiply(multiply(translation(cx, cy), rotation(first)), translation(-cx, -cy)),
        );
        break;
      }
      case 'skewX':
        matrix = multiply(matrix, { ...IDENTITY, c: Math.tan((first * Math.PI) / 180) });
        break;
      case 'skewY':
        matrix = multiply(matrix, { ...IDENTITY, b: Math.tan((first * Math.PI) / 180) });
        break;
      default:
        error = `${name}() is not a transform this reads`;
    }
  }
  return { matrix, error };
}

/**
 * A paint value: a colour, the absence of one, or something this cannot turn
 * into a hex pair — a gradient reference, a name nobody has heard of.
 */
export type ColourValue =
  | { kind: 'colour'; hex: string }
  | { kind: 'none' }
  | { kind: 'unreadable'; text: string };

/**
 * The colour names worth carrying, as a packed table.
 *
 * Not the whole CSS list: a name this does not know comes back unreadable and
 * lands in the report, which is a better outcome than a table half-remembered
 * from the specification quietly painting the wrong colour.
 */
const NAMED_COLOURS =
  'black 000000,silver c0c0c0,gray 808080,grey 808080,white ffffff,maroon 800000,' +
  'red ff0000,purple 800080,fuchsia ff00ff,magenta ff00ff,green 008000,lime 00ff00,' +
  'olive 808000,yellow ffff00,navy 000080,blue 0000ff,teal 008080,aqua 00ffff,' +
  'cyan 00ffff,orange ffa500,pink ffc0cb,brown a52a2a,gold ffd700,indigo 4b0082,' +
  'violet ee82ee,salmon fa8072,tomato ff6347,tan d2b48c,khaki f0e68c,plum dda0dd,' +
  'orchid da70d6,beige f5f5dc,ivory fffff0,azure f0ffff,coral ff7f50,crimson dc143c,' +
  'darkblue 00008b,darkred 8b0000,darkgreen 006400,darkgray a9a9a9,darkgrey a9a9a9,' +
  'lightgray d3d3d3,lightgrey d3d3d3,lightblue add8e6,lightgreen 90ee90,skyblue 87ceeb,' +
  'steelblue 4682b4,slategray 708090,slategrey 708090,midnightblue 191970,' +
  'forestgreen 228b22,seagreen 2e8b57,limegreen 32cd32,springgreen 00ff7f,' +
  'turquoise 40e0d0,wheat f5deb3,whitesmoke f5f5f5,snow fffafa,linen faf0e6,' +
  'lavender e6e6fa,thistle d8bfd8,peru cd853f,sienna a0522d,chocolate d2691e,' +
  'firebrick b22222,goldenrod daa520,hotpink ff69b4,deeppink ff1493,dodgerblue 1e90ff,' +
  'royalblue 4169e1,slateblue 6a5acd,mediumpurple 9370db,rebeccapurple 663399';

const BY_NAME = new Map(
  NAMED_COLOURS.split(',').map((entry) => {
    const [name, hex] = entry.split(' ');
    return [name ?? '', `#${(hex ?? '').toUpperCase()}`] as const;
  }),
);

const byte = (value: number): string =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0').toUpperCase();

/**
 * A `fill` or `stroke` value as a hex colour.
 *
 * Hex is upper-cased and expanded to six digits, so `#fff` and `#FFFFFF` are
 * the same colour by the time anything compares them — which the document does,
 * every time it decides whether a swatch is the current one.
 */
export function parseColour(value: string | undefined): ColourValue {
  if (value === undefined) return { kind: 'unreadable', text: '' };
  const text = value.trim();
  if (text === '') return { kind: 'unreadable', text };
  const lower = text.toLowerCase();
  if (lower === 'none' || lower === 'transparent') return { kind: 'none' };

  if (text.startsWith('#')) {
    const digits = text.slice(1);
    if (/^[0-9a-fA-F]{3,4}$/.test(digits)) {
      const expanded = [...digits.slice(0, 3)].map((digit) => `${digit}${digit}`).join('');
      return { kind: 'colour', hex: `#${expanded.toUpperCase()}` };
    }
    if (/^[0-9a-fA-F]{6,8}$/.test(digits)) {
      return { kind: 'colour', hex: `#${digits.slice(0, 6).toUpperCase()}` };
    }
    return { kind: 'unreadable', text };
  }

  const functional = /^rgba?\s*\(([^)]*)\)$/i.exec(text);
  if (functional) {
    const parts = parseNumbers(functional[1] ?? '');
    const [r, g, b] = parts;
    if (r === undefined || g === undefined || b === undefined) return { kind: 'unreadable', text };
    // Percentages are read as the numbers they are written as, which is wrong
    // for `rgb(50%,0%,0%)` — so that form is refused rather than mis-read.
    if ((functional[1] ?? '').includes('%')) return { kind: 'unreadable', text };
    return { kind: 'colour', hex: `#${byte(r)}${byte(g)}${byte(b)}` };
  }

  const named = BY_NAME.get(lower);
  if (named) return { kind: 'colour', hex: named };
  return { kind: 'unreadable', text };
}
