import * as v from 'valibot';
import type { optionSettings, refSettings } from './schemas';
import { FieldValue, type Id, Json, type Scalar } from './values';

// The resource contract's field metadata, as valibot schemas first, their
// types inferred from them so the two can't drift: per field its key and
// label, its type (its kind, the settings that kind takes, whether it holds a
// list), its format, and what a query and a write may do with it. A kind is a
// registered name, as a format and an operator are: bh registers nine kinds
// (`baseKinds`) and an app may add its own (`createRegistry`). What the
// registries hold (KindSpec, OperatorSpec, FormatSpec) carries code and
// schemas, so it is typed by hand.

/** A name a registry holds or a key names: not empty. */
const name = v.pipe(v.string(), v.nonEmpty());

/** The fields that play a part in every row, each by its key. */
export const ResourceRoles = v.strictObject({
  /** The field that names a row: 'id'. */
  idField: name,
  /**
   * The field a row reads by in one line wherever it's named (a link, a
   * picker, a group), often a templated one: 'name' → 'TIX-12 Fix the login'.
   */
  titleField: name,
  /**
   * The url field holding the row's picture, shown beside its title: 'photo',
   * or a templated field ('/api/users/{id}/avatar'); none, or an empty value
   * → no picture.
   */
  imageField: v.optional(name),
  /**
   * The field a write's `version` is checked against: 'updatedAt'; none → no
   * check, and the last write wins.
   */
  versionField: v.optional(name),
});
export type ResourceRoles = v.InferOutput<typeof ResourceRoles>;

/**
 * Text with field paths in braces: '{project}-{number} {title}', '{name}'.
 * A placeholder shows its value as text: an option its label, a ref the
 * title of the row it points at, a formatted field in its format, a many field
 * its values joined by ', ', an empty value nothing. The result is trimmed
 * and its runs of spaces fold into one.
 * In a templated field of kind `url`, each placeholder's value is
 * URL-encoded, so a space or a slash can't break the address, and an empty
 * one leaves the field empty.
 * '{{' and '}}' are a brace.
 * It holds no code, only placeholders and text: a stored definition holds no
 * logic.
 */
export const Template = v.string();
export type Template = v.InferOutput<typeof Template>;

/** A registered kind's name: one of bh's (BaseKind) or an app's own. */
export type FieldKind = string;

/**
 * A registered operator's name: one of bh's fifteen (baseOperators) or an app's
 * own. Each kind allows the ones that mean something for it, in its own entry
 * (KindSpec.operators), and a field may allow fewer (FieldQuery.filter).
 */
export type Operator = string;

/**
 * What a field holds: a value of its kind, or a list of them. Its kind checks
 * it as one object (KindSpec): {kind: 'option', many: true, settings:
 * {options: […]}}.
 */
export const FieldType = v.strictObject({
  /** A registered kind: 'option'. */
  kind: name,
  /**
   * What its kind takes besides these keys, checked by the kind's settings
   * schema: an option field's options, a ref field's resource (KindSettings).
   */
  settings: v.optional(v.record(v.string(), Json)),
  /** Holds a list: labels, several assignees; only where its kind allows it. */
  many: v.optional(v.literal(true)),
});
export type FieldType = v.InferOutput<typeof FieldType>;

/**
 * How a field's value shows: a format registered in bh's format registry, by
 * its name, or by its name with options. Any registered format that takes the
 * field's kind will do, an app's own too: 'bytes', 'relative',
 * { name: 'money', options: { currency: 'EUR' } }.
 */
export const FieldFormat = v.union([
  name,
  v.strictObject({ name, options: v.record(v.string(), Json) }),
]);
export type FieldFormat = v.InferOutput<typeof FieldFormat>;

/** What a query may do with a field: no more than its kind allows (KindSpec). */
export const FieldQuery = v.strictObject({
  /** The operators it allows, some of its kind's; [] → not filterable. */
  filter: v.array(name),
  sort: v.boolean(),
  group: v.boolean(),
  /** A query's `search` looks in it. */
  search: v.boolean(),
});
export type FieldQuery = v.InferOutput<typeof FieldQuery>;

/** What a write may do with a field. */
export const FieldWrite = v.strictObject({
  /** A create may set it. */
  create: v.boolean(),
  /** A patch may change it. */
  update: v.boolean(),
  /** A create must set it (unless it has a default), and a patch can't clear it. */
  required: v.boolean(),
  /**
   * What a create that leaves it out gets: a value of its kind; a list on a
   * many field.
   */
  default: v.optional(FieldValue),
});
export type FieldWrite = v.InferOutput<typeof FieldWrite>;

/**
 * A field's key: 'status'; unique in its resource, without a dot (a dot
 * starts a path: 'status.kind').
 */
export const FieldKey = v.pipe(
  v.string(),
  v.nonEmpty('a field’s key is not empty'),
  v.check((key) => !key.includes('.'), 'a field’s key has no dot'),
);

/**
 * A field, of any kind. Its kind (`type.kind`) is a name in the kind registry
 * (KindSpec): one of bh's nine or an app's own. The kind says what the field's
 * value is, which operators filter it, whether it sorts, groups and holds a
 * list, and what settings it takes.
 */
export const FieldMeta = v.strictObject({
  key: FieldKey,
  /** 'Status' */
  label: v.string(),
  /** What it holds (FieldType). */
  type: FieldType,
  /**
   * How its value shows: a registered format that takes its kind; the kind's
   * default when absent. bh's default renderer for the kind uses it, so a
   * field shows the same in every table, list, card and form unless a
   * template says otherwise.
   */
  format: v.optional(FieldFormat),
  /**
   * A templated field's value: the server fills it on every row from the
   * row's other fields, '{project}-{number} {title}'; it is never written
   * (its write.create and write.update are false).
   */
  template: v.optional(Template),
  /** What a query may do with it. */
  query: FieldQuery,
  /** What a write may do with it, and its default. */
  write: FieldWrite,
});
export type FieldMeta = v.InferOutput<typeof FieldMeta>;

/**
 * What the metadata knows of a registered kind, to check a field of it and
 * the queries and writes that name it. An app registers its own beside bh's
 * nine (createRegistry), with its SQL for the database adapter and its default
 * renderer.
 */
export interface KindSpec {
  /** 'option' */
  name: string;
  /** Its settings' valibot schema; none → it takes none. */
  settings?: v.GenericSchema;
  /**
   * Its value's valibot schema, given a field's `type.settings`: an option's
   * value is one of the field's options. One value, never null: a field's
   * null and a many field's list are the field's, not the kind's.
   */
  value: (settings?: Record<string, Json>) => v.GenericSchema;
  /** A field of it may hold a list. */
  many: boolean;
  /** The most a field of it may allow (FieldQuery): registered operators by name. */
  operators: Operator[];
  sort: boolean;
  group: boolean;
  search: boolean;
  /** The format a field of it gets when it names none: 'plain', 'date'. */
  format?: string;
}

/**
 * The kinds bh registers. Their values are KindValue's, their order Sort's,
 * and each names its operators in its entry of baseKinds; only option and ref
 * take settings (KindSettings).
 *
 * ```
 *            many  sort  group  search  format
 * text       yes   yes   -      yes     plain
 * url        yes   yes   -      yes     -
 * number     -     yes   -      -       number
 * boolean    -     yes   yes    -       -
 * date       -     yes   -      -       date
 * datetime   -     yes   -      -       datetime
 * option     yes   yes   yes    -       -
 * ref        yes   yes   yes    -       -
 * json       -     -     -      -       -
 * ```
 */
export type BaseKind = keyof KindValue;

/** The settings of bh's kinds that take any. */
export interface KindSettings {
  option: v.InferOutput<typeof optionSettings>;
  ref: v.InferOutput<typeof refSettings>;
}

/**
 * What the query knows of a registered operator, to check a condition that
 * names it and to tell whether a row passes it. bh registers fifteen
 * (baseOperators); an app registers its own beside them (createRegistry),
 * with its SQL for each database adapter it runs on and the value input its
 * filter form shows for it.
 */
export interface OperatorSpec {
  /** 'in' */
  name: string;
  /** How a filter reads it: 'is any of'. */
  label: string;
  /**
   * How it reads where `label` doesn't fit: on a kind ({ kinds: { date: 'is
   * before' } }), or on a field holding a list ({ many: 'has any of' }). A
   * kind's words come first, then a list's, then `label` (operatorLabel).
   */
  labels?: { kinds?: Record<FieldKind, string>; many?: string };
  /**
   * Its operand's valibot schema, given the field's value schema (its kind's
   * KindSpec.value): `in` takes 1 to 100 values; none → it takes no operand,
   * as `empty` does.
   */
  operand?: (value: v.GenericSchema) => v.GenericSchema;
  /**
   * Does a row's value pass, given the operand? The value is the field's: one
   * value, a many field's list, or null. `viewer` is the signed-in user's id,
   * for an operator about who is asking (isMe); undefined when no one is
   * signed in. Plain JavaScript, by the same rules as each adapter's SQL for
   * it, which lives in that adapter, never here.
   */
  matches: (
    value: Scalar | Scalar[] | null,
    operand?: Scalar | Scalar[],
    viewer?: Scalar,
  ) => boolean;
}

/**
 * What the metadata knows of a registered format, to check a field's: the
 * kinds it takes and its options. Each entry of bh's format registry carries
 * it.
 */
export interface FormatSpec {
  /** 'money' */
  name: string;
  /** The kinds it formats: ['number']. */
  kinds: FieldKind[];
  /**
   * Its options' valibot schema: { currency: an ISO 4217 code }; none → it
   * takes none.
   */
  options?: v.GenericSchema;
}

/** The value of each of bh's kinds. */
export interface KindValue {
  text: string;
  /**
   * Absolute, with its scheme ('https://…'), or a path from the root
   * ('/api/users/7/avatar'), which a client resolves against the API's
   * address: a browser on its own, a client outside it by joining the two.
   */
  url: string;
  number: number;
  boolean: boolean;
  /** '2026-10-12': no time, no zone. */
  date: string;
  /** '2026-10-12T09:30:00.000Z': ISO 8601, in UTC. */
  datetime: string;
  /** One of the field's OptionMeta values. */
  option: string;
  /** The id of a row of the resource its `type.settings.of` names. */
  ref: Id;
  json: Json;
}
