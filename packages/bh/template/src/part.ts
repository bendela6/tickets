import type {
  FieldFormat,
  FieldMeta,
  FieldKind,
  FieldPath,
  Filter,
  Json,
  KindRegistry,
  Template,
} from '@bh/resource';
import { entryOf } from './registry';

// A part: a leaf of a template, one thing the record shows. What it shows is a
// field, a constant or a text template; a registered renderer draws it, a
// registered format turns its value into text, and its options say how its
// text looks. What it doesn't name it takes from its field, so a field shows
// the same in every table, list, tile and card unless a template says
// otherwise.

/**
 * What draws a part: a renderer in the renderer registry (TK-79.3), by its
 * name, or by its name with the options it takes, as a field's `format` names
 * a format: 'pill', { name: 'link', options: { to: '/p/{project}/t/{number}' } }.
 * Any registered one that shows the part's value will do, an app's own too.
 */
export type PartRenderer = string | { name: string; options: Record<string, Json> };

/**
 * How a part's text looks, and what it says beside its value or in its
 * place. bh's renderers take each the same way; one with nothing to say for
 * an option (an avatar's weight) leaves it be.
 */
export interface PartOptions {
  /** A bh tone, by its name: 'blue', 'danger'. Its text's color, or a pill's. The renderer's own when absent. */
  tone?: string;
  /** In the monospace face: an id, a hash, a host. */
  mono?: boolean;
  /** Its text's weight: 400 regular, 500 medium, 600 semibold. The renderer's own when absent. */
  weight?: 400 | 500 | 600;
  /** The most lines its text takes; past them, it ends in an ellipsis. 1 keeps it to one line. */
  clamp?: number;
  /** Text before its value, while it has one: '#', 'v', 'up '. */
  prefix?: string;
  /**
   * What it says while its value is empty (none, null, '' or a list holding
   * none): '—', 'Unassigned'. Absent, an empty part shows nothing at all, and
   * takes no room in its layout.
   */
  empty?: string;
}

interface PartBase {
  /**
   * What draws it. When absent, a field part's kind's default renderer
   * (TK-79.3), and text for a constant or a text template.
   */
  renderer?: PartRenderer;
  /**
   * How its value reads as text: a registered format (TK-79.4), by its name
   * or with options, as a field's `format` names one. When absent, a field
   * part's field's format, else its kind's (KindSpec.format); a text
   * template's placeholders show each in its own field's.
   */
  format?: FieldFormat;
  /** How its text looks, and what it says beside its value or in its place. */
  options?: PartOptions;
  /**
   * A filter on the record (@bh/resource's Filter): the part shows only while
   * it holds. Without one, it always shows.
   */
  when?: Filter;
  /** A part is a leaf: it names no layout… */
  layout?: never;
  /** …and holds no nodes. */
  nodes?: never;
}

/** A part showing a field's value: { field: 'title' }. */
export interface FieldPart extends PartBase {
  /** A field's key, or an option field's key and attribute: 'status.kind'. */
  field: FieldPath;
  value?: never;
  text?: never;
}

/** A part showing a constant, never empty: an icon's name, a separator, a fixed label. */
export interface ValuePart extends PartBase {
  value: Exclude<Json, null>;
  field?: never;
  text?: never;
}

/**
 * A part showing text with fields' values in it, @bh/resource's Template:
 * '{project}-{number}'. Empty when nothing is left of it once filled and
 * trimmed (fillText).
 */
export interface TextPart extends PartBase {
  text: Template;
  field?: never;
  value?: never;
}

/**
 * A part: a leaf of a template, one thing the record shows. What it shows is
 * a field, a constant or a text template, one of the three.
 */
export type Part = FieldPart | ValuePart | TextPart;

/**
 * A field as a template reads it: its key and label, its kind and settings,
 * and its format. A resource's FieldMeta is one; a template needs no more.
 */
export type TemplateField = Pick<FieldMeta, 'key' | 'label' | 'type' | 'format'>;

/** Where a part's defaults come from. */
export interface PartDefaults {
  /**
   * The renderer a kind's values show with when a part names none: the
   * renderer registry's default for it (TK-79.3), undefined for a kind it has
   * none for.
   */
  renderer: (kind: FieldKind) => string | undefined;
  /** The kinds, for the format a field gets when it names none (KindSpec.format). */
  kinds: KindRegistry;
}

/** bh's renderer for plain text (TK-79.3): a constant's, a text template's, and a kind's without one. */
const TEXT = 'text';

/**
 * The part with what it leaves out taken from what it shows. A part naming
 * no renderer takes its field's kind's default renderer; one naming no format
 * takes its field's format, else its field's kind's. A constant or a text
 * template naming no renderer is drawn as text, as a field of a kind with no
 * default renderer is; neither takes a format it doesn't name.
 *
 * `field` is the metadata of what a field part shows (an attribute's, for a
 * path to one): none for a constant or a text template, or for a field the
 * resource doesn't have.
 */
export function resolvePart<P extends Part>(
  part: P,
  field: Pick<FieldMeta, 'type' | 'format'> | undefined,
  defaults: PartDefaults,
): P & { renderer: PartRenderer } {
  const kind = part.field === undefined ? undefined : field?.type.kind;
  const renderer =
    part.renderer ?? (kind === undefined ? undefined : defaults.renderer(kind)) ?? TEXT;
  const format =
    part.format ??
    (kind === undefined
      ? undefined
      : (field?.format ??
        (defaults.kinds.has(kind) ? defaults.kinds.get(kind).format : undefined)));
  return { ...part, renderer, ...(format === undefined ? {} : { format }) };
}

/** A part's defaults: each kind's renderer, and the kinds for their formats. */
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
