/**
 * What an icon *is*, as data. `MarkConfig` described one specific drawing —
 * three sticks — so nothing else could ever be drawn. A document holds named
 * inks, an ordered list of elements, and variants that re-point the palette and
 * scale the whole drawing.
 */

/** The square every measurement is expressed against. */
export const GRID = 48;
export const CENTRE = GRID / 2;

/** Reach of a bare stick: it spans the full diameter, 6..42 on a 48 grid. */
export const BARE_REACH = 18;

/** Weight-to-reach ratio the bare mark holds, and every scaled variant inherits. */
export const RATIO = 1 / 3;

/** A colour with a value per theme. */
export interface Ink {
  light: string;
  dark: string;
}

interface ElementBase {
  /** Stable across edits; React keys and per-element controls hang off it. */
  id: string;
  /** Name of an entry in `IconDoc.inks`. */
  ink: string;
  /** Takes part in the running formation. */
  spin?: boolean;
}

/** A full diameter through the centre, rotated. */
export interface Stick extends ElementBase {
  type: 'stick';
  /** Degrees. */
  angle: number;
  /** Half-length, in grid units. */
  reach: number;
  /** Stroke width, in grid units. */
  weight: number;
}

/** A concentric stroked circle. */
export interface Ring extends ElementBase {
  type: 'ring';
  radius: number;
  weight: number;
}

/** A filled circle at an arbitrary point on the grid. */
export interface Dot extends ElementBase {
  type: 'dot';
  /** `[x, y]` in grid units. */
  at: [number, number];
  radius: number;
}

export type Element = Stick | Ring | Dot;
export type ElementType = Element['type'];

export const ELEMENT_TYPES: readonly ElementType[] = ['stick', 'ring', 'dot'];

/** How a variant resolves every ink. */
export type InkResolution = 'theme' | 'light' | 'dark' | 'black';

export const INK_RESOLUTIONS: readonly InkResolution[] = ['theme', 'light', 'dark', 'black'];

/** The plate a variant draws its elements on. */
export interface Field {
  /** Name of an entry in `IconDoc.inks`, like any other colour. */
  ink: string;
  /** Corner radius in grid units; 0 is square. */
  radius: number;
}

export interface Variant {
  inks: InkResolution;
  /** Multiplies every element's lengths and stroke widths together. */
  scale: number;
  field?: Field;
}

/** Unchanged from the mark spec. */
export interface MotionConfig {
  speed: number;
  restSpread: number;
  ramp: number;
  restPose: 'logo' | 'fan';
}

export interface IconDoc {
  inks: Record<string, Ink>;
  /** Painted in order, back to front. */
  elements: Element[];
  variants: Record<string, Variant>;
  motion: MotionConfig;
}

/**
 * The locked mark, expressed as a document. Element ids match the stick names
 * the mark spec uses, so a reader can line this up against it.
 */
export const DEFAULT_DOC: IconDoc = {
  inks: {
    top: { light: '#7167ff', dark: '#6652ff' },
    mid: { light: '#00bb9a', dark: '#12b898' },
    low: { light: '#ff298a', dark: '#ff378c' },
    field: { light: '#1b1830', dark: '#1b1830' },
  },
  elements: [
    { id: 'top', type: 'stick', ink: 'top', spin: true, angle: 62, reach: BARE_REACH, weight: 6 },
    { id: 'mid', type: 'stick', ink: 'mid', spin: true, angle: 27, reach: BARE_REACH, weight: 6 },
    { id: 'low', type: 'stick', ink: 'low', spin: true, angle: 160, reach: BARE_REACH, weight: 6 },
  ],
  variants: {
    favicon: { inks: 'theme', scale: 1 },
    mono: { inks: 'black', scale: 1 },
    chip: { inks: 'dark', scale: 14 / BARE_REACH, field: { ink: 'field', radius: 11 } },
  },
  motion: { speed: 120, restSpread: 8, ramp: 0.9, restPose: 'logo' },
};
