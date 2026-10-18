import {
  valueAt,
  type FieldFormat,
  type FieldPath,
  type Id,
  type Json,
  type KindRegistry,
  type Row,
} from '@bh/resource';
import { formatValue } from './format/formats';
import { formatText } from './format/pieces';
import type { FormatContext, FormatRegistry } from './format/registry';
import type { Part, PartRenderer, TemplateField } from './part';
import type { Shown } from './renderer-registry';
import { fillText } from './text';

// What a part shows, made ready for its renderer: each value with its text
// in its format, an option's label and color, the title and picture of the
// row a ref points at, a text template filled. Renderers only draw what this
// gives them, so a server writes a cell's text (an export, an answer from
// MCP) as a browser draws it.

/** The row a ref field's id points at, as a part shows it: its title and its picture. */
export interface RefTarget {
  /** Its resource's `roles.titleField`'s value: 'Ana Lee', 'TIX-12 Fix the login'. */
  title: string;
  /** Its resource's `roles.imageField`'s value, an address; none → initials. */
  image?: string;
}

/** What a part's values are read and written with, besides the record. */
export interface ShowContext {
  /** The record's fields: each one's kind, settings and format. */
  fields: readonly TemplateField[];
  /** The formats, bh's and the app's own. */
  formats: FormatRegistry;
  /** The kinds, for the format a field gets when it names none (KindSpec.format). */
  kinds: KindRegistry;
  /** The locale, time zone and now the formats write with. */
  format?: FormatContext;
  /** The row a ref's id points at; none, or undefined for an id, → the id as text. */
  refOf?: (field: TemplateField, id: Id) => RefTarget | undefined;
}

/** Whether a value holds nothing to show: none, null, '' or a list holding none. */
function isEmpty(value: Json | undefined): value is null | undefined | '' | [] {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

/** An option the field's settings list, by its value. */
interface OptionShown {
  value: Json;
  label?: string;
  color?: string;
}

function optionsOf(field: TemplateField): readonly OptionShown[] {
  const options = field.type.settings?.options;
  return Array.isArray(options) ? (options as unknown as OptionShown[]) : [];
}

/**
 * The field a path names, as a part reads it: a field of the record, or,
 * past a dot, an option field's attribute ('status.kind'), an option
 * attribute with its own options. Undefined for one the record's fields
 * don't have, and for a key into an object value ('services.name').
 */
export function fieldAt(
  path: FieldPath,
  fields: readonly TemplateField[],
): TemplateField | undefined {
  const [key = '', name] = path.split('.');
  const field = fields.find((each) => each.key === key);
  if (name === undefined || field === undefined) {
    return field;
  }
  const attributes = field.type.settings?.attributes;
  const attribute = Array.isArray(attributes)
    ? (attributes as { key?: Json; label?: Json; kind?: Json; options?: Json }[]).find(
        (each) => each.key === name,
      )
    : undefined;
  if (attribute === undefined || typeof attribute.kind !== 'string') {
    return undefined;
  }
  return {
    key: path,
    label: typeof attribute.label === 'string' ? attribute.label : name,
    type: {
      kind: attribute.kind,
      ...(attribute.options === undefined ? {} : { settings: { options: attribute.options } }),
    },
  };
}

/** One value as its field shows it. */
function shownOne(
  value: Exclude<Json, null>,
  field: TemplateField | undefined,
  format: FieldFormat | undefined,
  context: ShowContext,
): Shown {
  const kind = field?.type.kind;
  if (field && kind === 'option') {
    const option = optionsOf(field).find((each) => each.value === value);
    return {
      value,
      text: option?.label ?? String(value),
      ...(option?.color === undefined ? {} : { tone: option.color }),
    };
  }
  if (field && kind === 'ref' && (typeof value === 'string' || typeof value === 'number')) {
    const target = context.refOf?.(field, value);
    return {
      value,
      text: target?.title ?? String(value),
      ...(target?.image === undefined ? {} : { image: target.image }),
    };
  }
  return { value, text: formatText(formatValue(context.formats, format, value, context.format)) };
}

/**
 * Each value a field holds, ready for its renderer: one, or one per entry of
 * a many field, those holding nothing left out; none for an empty value.
 * `format` is the part's, already resolved (resolvePart).
 */
export function shownOf(
  value: Json | undefined,
  field: TemplateField | undefined,
  format: FieldFormat | undefined,
  context: ShowContext,
): Shown[] {
  if (isEmpty(value)) {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((each) => {
    return isEmpty(each) ? [] : [shownOne(each, field, format, context)];
  });
}

/**
 * A text template filled from the record, each placeholder its field's
 * values in its own format, joined by ', '. A malformed one shows as written,
 * so a stored mistake takes nothing down (validateTemplate reports it).
 */
export function textOf(text: string, record: Row, context: ShowContext): string {
  try {
    return fillText(text, (path) => {
      const field = fieldAt(path, context.fields);
      const kind = field?.type.kind;
      const format =
        field?.format ??
        (kind === undefined
          ? undefined
          : context.kinds.has(kind)
            ? context.kinds.get(kind).format
            : undefined);
      return shownOf(valueAt(path, record, context) as Json, field, format, context)
        .map((shown) => shown.text)
        .join(', ');
    });
  } catch {
    return text;
  }
}

/**
 * What a part shows, ready for its renderer: a field's values, a constant,
 * or a text template filled; none when it holds nothing. `part` is resolved
 * (resolvePart), so its format is its own, its field's or its kind's.
 */
export function partValues(
  part: Part & { renderer: PartRenderer },
  record: Row,
  context: ShowContext,
): Shown[] {
  if (part.field !== undefined) {
    const value = valueAt(part.field, record, context) as Json;
    return shownOf(value, fieldAt(part.field, context.fields), part.format, context);
  }
  if (part.text !== undefined) {
    const text = textOf(part.text, record, context);
    return text === '' ? [] : [{ value: text, text }];
  }
  return shownOf(part.value, undefined, part.format, context);
}
