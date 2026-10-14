import * as v from 'valibot';
import type { BaseKind, FieldKind, FieldMeta, Json, KindRegistry, Row } from '@bh/resource';
import { isRoute } from './link';
import type { PartDefaults, PartOptions } from './part';
import { entryOf } from './registry';

// The renderer registry, the half of it that needs no React: what each
// renderer shows, the options it takes and the room it needs, and what a
// renderer is given to draw a part. A server checks a template against it;
// @bh/ui puts a component beside each of bh's (`baseRenderers`), and an app
// spreads those and adds its own, as a form's inputs are. One set serves every
// host: a column's cell, a list item, a tile and a card.

/**
 * One value as a renderer draws it, made ready by what draws the template
 * (TK-79.7) from the record, the field's metadata and its format.
 */
export interface Shown {
  /**
   * The value: one of its field's kind (a number, a date, an option's value, a
   * ref's id), or the part's constant.
   */
  value: Exclude<Json, null>;
  /**
   * It as text, in its format: a number or a date formatted, an option's
   * label, the title of the row a ref points at, a text template filled.
   */
  text: string;
  /** Its own tone, where it has one: an option's color. The part's `tone` wins over it. */
  tone?: string;
  /**
   * Its picture, where it has one: the image of the row a ref points at (its
   * resource's `roles.imageField`), or a url value's own address.
   */
  image?: string;
}

/**
 * What a renderer is given to draw a part. `O` is the renderer's own
 * options, as its schema gives them.
 */
export interface RendererProps<O = Record<string, never>> {
  /**
   * What it draws: one value for a field holding one, a constant or a text
   * template; one per entry of a many field, in order. Never none: a part
   * whose value is empty draws its `empty` text, or nothing, instead.
   */
  values: readonly Shown[];
  /** Its own options: a part's `renderer: {name, options}`, {} when it names it alone. */
  options: O;
  /**
   * The part's options, which bh's renderers share: tone, mono, weight,
   * clamp and prefix. Its `empty` is the template's to draw, never the
   * renderer's.
   */
  part: PartOptions;
  /** The field it shows, for a field part: its label, kind and settings. */
  field?: FieldMeta;
  /** The record the template draws: a link fills its route from it (linkTarget). */
  record: Row;
}

/**
 * What the renderer registry knows of a renderer besides its component:
 * enough to check a part that names it, on a server too. `O` is its options.
 */
export interface RendererSpec<O = Record<string, never>> {
  /**
   * The kinds of field it shows: ['number']; 'any' for every kind. A constant
   * or a text template is no field's, and any renderer may draw it.
   */
  kinds: 'any' | readonly FieldKind[];
  /**
   * Its options' valibot schema: what a part naming it with options may give
   * it. None → it takes none.
   */
  options?: v.GenericSchema<unknown, O>;
  /**
   * The least width it needs to be read, in pixels: a host narrower than it
   * leaves a part drawn with it out, as a narrow column drops a bar. None → it
   * fits any width, as text does, clamped or cut short.
   */
  minWidth?: number;
}

/** A renderer: its spec and the component that draws it, `C`: React's in @bh/ui. */
export interface RendererEntry<C, O = Record<string, never>> extends RendererSpec<O> {
  /** Draws a part, given RendererProps<O>. */
  Component: C;
}

const positive = v.pipe(v.number(), v.finite(), v.gtValue(0));

const avatarSize = v.picklist(['xs', 'sm', 'md', 'lg', 'xl']);

const pillOptions = v.strictObject({
  /** How much of its tone it spends: as @bh/ui's Pill takes it; subtle when absent. */
  variant: v.optional(v.picklist(['subtle', 'solid', 'outline', 'text', 'tint'])),
});

const linkOptions = v.strictObject({
  /**
   * Its target, a route filled from the record (linkTarget): text with field
   * paths in braces, starting as an address does, '/p/{project}/t/{number}'.
   * Absent, a url links to itself.
   */
  to: v.optional(
    v.pipe(
      v.string(),
      v.check(
        isRoute,
        'a route is a path from the root or an address with its scheme, its braces in pairs',
      ),
    ),
  ),
});

const avatarOptions = v.strictObject({
  /** A rung of @bh/ui's Avatar: 16, 18, 22, 28 or 36 pixels; sm when absent. */
  size: v.optional(avatarSize),
  /** Round or square corners; round when absent. */
  shape: v.optional(v.picklist(['round', 'square'])),
});

const userOptions = v.strictObject({
  /** Its avatar's rung, as avatar's; sm when absent. */
  size: v.optional(avatarSize),
});

const iconOptions = v.strictObject({
  /** A rung of @bh/ui's Icon: 8, 10, 12, 14, 16, 20 or 28 pixels; md when absent. */
  size: v.optional(v.picklist(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'])),
});

const progressOptions = v.strictObject({
  /** The value that fills the bar; 100 when absent, so a percent fills it. */
  max: v.optional(positive),
});

const meterOptions = v.strictObject({
  /** The whole the value is a share of; 1 when absent, so a fraction fills it. */
  max: v.optional(positive),
});

const trendOptions = v.strictObject({
  /** Which way is good: up (more is better) or down; up when absent. */
  good: v.optional(v.picklist(['up', 'down'])),
});

export type LinkOptions = v.InferOutput<typeof linkOptions>;
export type PillOptions = v.InferOutput<typeof pillOptions>;
export type AvatarOptions = v.InferOutput<typeof avatarOptions>;
export type UserOptions = v.InferOutput<typeof userOptions>;
export type IconOptions = v.InferOutput<typeof iconOptions>;
export type ProgressOptions = v.InferOutput<typeof progressOptions>;
export type MeterOptions = v.InferOutput<typeof meterOptions>;
export type TrendOptions = v.InferOutput<typeof trendOptions>;

/** The options of a renderer that takes none. */
type NoOptions = Record<string, never>;

/**
 * bh's renderers, each by its name with the options it takes. @bh/ui draws
 * each one (`baseRenderers`).
 */
export interface BaseRenderers {
  /** Its text, of any kind: plain, in its format. */
  text: NoOptions;
  /** Its text, to its route (`to`, filled from the record), or a url's to itself. */
  link: LinkOptions;
  /** Each value in a pill, in its tone: an option in its color, a label. */
  pill: PillOptions;
  /** A date's or a datetime's text, with the exact moment on hover. */
  date: NoOptions;
  /** A number's text, its digits of one width. */
  number: NoOptions;
  /** A picture alone: a url's, or the row a ref points at's, else its initials. */
  avatar: AvatarOptions;
  /** The row a ref points at, by its picture and its title: a user's avatar and name. */
  user: UserOptions;
  /** A glyph from @bh/ui's icon registry, by the value's name. */
  icon: IconOptions;
  /** A bar of how far along: the value out of `max`. */
  progress: ProgressOptions;
  /** A bar of a share of a whole, toned by how full it is: the value out of `max`. */
  meter: MeterOptions;
  /** A change, with an arrow its way, toned by whether that way is good. */
  trend: TrendOptions;
  /** A check for true; nothing to see for false. */
  check: NoOptions;
  /** JSON, or text, as code. */
  code: NoOptions;
}

/**
 * bh's renderers' specs: the kinds each shows, its options' schema, the room
 * it needs. @bh/ui puts each one's component beside it.
 */
export const baseRendererSpecs: {
  readonly [K in keyof BaseRenderers]: RendererSpec<BaseRenderers[K]>;
} = Object.freeze({
  text: { kinds: 'any' },
  link: { kinds: 'any', options: linkOptions },
  pill: { kinds: ['option', 'text'], options: pillOptions },
  date: { kinds: ['date', 'datetime'] },
  number: { kinds: ['number'] },
  avatar: { kinds: ['url', 'ref'], options: avatarOptions },
  user: { kinds: ['ref'], options: userOptions, minWidth: 64 },
  icon: { kinds: ['text'], options: iconOptions },
  progress: { kinds: ['number'], options: progressOptions, minWidth: 64 },
  meter: { kinds: ['number'], options: meterOptions, minWidth: 80 },
  trend: { kinds: ['number'], options: trendOptions, minWidth: 40 },
  check: { kinds: ['boolean'] },
  code: { kinds: ['json', 'text'] },
});

/**
 * The renderer a part showing a field of each of bh's kinds gets when it
 * names none, so a field shows the same everywhere: text as text (plain,
 * markdown or rich, by its format), a url as a link, a number or a date as
 * text in its format, a boolean as a check, an option as a pill in its color,
 * a ref as the row it points at, json as code. An app's own kind adds its
 * default beside them: `{ ...baseDefaultRenderers, color: 'swatch' }`.
 */
export const baseDefaultRenderers: Readonly<Record<BaseKind, keyof BaseRenderers>> = Object.freeze({
  text: 'text',
  url: 'link',
  number: 'number',
  boolean: 'check',
  date: 'date',
  datetime: 'date',
  option: 'pill',
  ref: 'user',
  json: 'code',
});

/** Whether a renderer shows a field of a kind. */
export function canShow(spec: RendererSpec<unknown>, kind: FieldKind): boolean {
  return spec.kinds === 'any' || spec.kinds.includes(kind);
}

/** Whether a renderer fits in a width, in pixels: one needing more room is left out. */
export function fits(spec: RendererSpec<unknown>, width: number): boolean {
  return spec.minWidth === undefined || width >= spec.minWidth;
}

/**
 * What resolvePart fills a part's renderer and format from: the default
 * renderer of each kind (baseDefaultRenderers, and an app's own beside them)
 * and the kinds, for their formats.
 */
export function partDefaults(
  renderers: Readonly<Record<FieldKind, string>>,
  kinds: KindRegistry,
): PartDefaults {
  return {
    renderer: (kind) => {
      return entryOf(renderers, kind);
    },
    kinds,
  };
}
