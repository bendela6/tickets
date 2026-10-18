import * as v from 'valibot';
import type { FieldKind, Json, Row } from '@bh/resource';
import type { PartOptions, TemplateField } from './part';
import { optionsSchema } from './registry';

/** One value, ready to draw. */
export interface Shown {
  /** The value: of its field's kind, or the part's constant. */
  value: Exclude<Json, null>;
  /** The value as text, in its format. */
  text: string;
  /** Its own tone: an option's color. The part's `tone` wins. */
  tone?: string;
  /** Its picture: a ref's row's image, or a url's own address. */
  image?: string;
}

/** What a renderer draws a part from. `O` is its options. */
export interface RendererProps<O = Record<string, never>> {
  /** The values: one, or one per entry of a many field. Never none. */
  values: readonly Shown[];
  /** Its own options. `{}` when the part names it alone. */
  options: O;
  /** The part's options: tone, mono, weight, clamp, prefix. */
  part: PartOptions;
  /** The field, for a field part. */
  field?: TemplateField;
  /** The record. */
  record: Row;
}

/** A renderer without its component. `O` is its options. */
export interface RendererSpec<O = Record<string, never>> {
  /** The kinds it shows: `['number']`, or `'any'`. */
  kinds: 'any' | readonly FieldKind[];
  /** Its options' schema. None: it takes none. */
  options?: v.GenericSchema<unknown, O>;
  /** Least width, in px. A narrower host leaves it out. */
  minWidth?: number;
}

/** A renderer: its spec and its component, `C`. */
export interface RendererEntry<C, O = Record<string, never>> extends RendererSpec<O> {
  /** Draws a part, given `RendererProps<O>`. */
  Component: C;
}

/** What a renderer registry checks of a renderer, beside its component. */
export const rendererData = v.object({
  kinds: v.union([
    v.literal('any'),
    v.pipe(v.array(v.string()), v.minLength(1, 'a renderer shows a kind, or any')),
  ]),
  options: v.optional(optionsSchema),
  minWidth: v.optional(v.pipe(v.number(), v.minValue(0, 'its least width is a width'))),
});

/** Whether a renderer shows a kind. */
export function canShow(spec: RendererSpec<unknown>, kind: FieldKind): boolean {
  return spec.kinds === 'any' || spec.kinds.includes(kind);
}

/** Whether a renderer fits a width, in px. */
export function fits(spec: RendererSpec<unknown>, width: number): boolean {
  return spec.minWidth === undefined || width >= spec.minWidth;
}
