import * as v from 'valibot';
import { Id, type Json, Scalar } from './values';

// The valibot schemas bh's kinds check their settings and values with, and
// the options and attributes an option field's settings hold.

/** An issue's path into `root` by its keys, as valibot reports one. */
export function pathTo(
  root: unknown,
  keys: readonly (string | number)[],
): [v.IssuePathItem, ...v.IssuePathItem[]] | undefined {
  const path: v.IssuePathItem[] = [];
  let input = root;
  for (const key of keys) {
    if (Array.isArray(input) && typeof key === 'number') {
      const value: unknown = input[key];
      path.push({ type: 'array', origin: 'value', input, key, value });
      input = value;
    } else if (typeof input === 'object' && input !== null && typeof key === 'string') {
      const record = input as Record<string, unknown>;
      const value = record[key];
      path.push({ type: 'object', origin: 'value', input: record, key, value });
      input = value;
    } else {
      break;
    }
  }
  const [first, ...rest] = path;
  return first ? [first, ...rest] : undefined;
}

const finite = v.pipe(v.number(), v.finite());

/** One of an option field's options. */
export const OptionMeta = v.strictObject({
  /** What a row holds and a filter names: 'in-progress'. */
  value: v.pipe(v.string(), v.nonEmpty('an option’s value is not empty')),
  /** 'In progress' */
  label: v.string(),
  /** A bh tone: 'blue', 'success'. */
  color: v.optional(v.string()),
  /** Its place in the list; sorting and grouping follow it. */
  order: finite,
  /** Shown on the rows that hold it, offered for no new value. */
  archived: v.optional(v.literal(true)),
  /** Keyed by AttributeMeta.key: { kind: 'active' }. */
  attributes: v.optional(v.record(v.string(), v.nullable(Scalar))),
});
export type OptionMeta = v.InferOutput<typeof OptionMeta>;

// A path names an attribute after its field's key and a dot ('status.kind'),
// one level deep, so an attribute's own key holds no dot.
const attributeKey = v.pipe(
  v.string(),
  v.nonEmpty('an attribute’s key is not empty'),
  v.check((key) => !key.includes('.'), 'an attribute’s key has no dot'),
);

/**
 * What an option field's options carry besides a label: a status's group
 * (tickets' `kind`). A path names one: 'status.kind'. Only an option
 * attribute has options of its own: { key: 'kind', label: 'Group', kind:
 * 'option', options: [todo, active, blocked, done, dropped] }.
 */
export const AttributeMeta = v.variant('kind', [
  v.strictObject({
    key: attributeKey,
    label: v.string(),
    kind: v.picklist(['text', 'number', 'boolean']),
  }),
  v.strictObject({
    key: attributeKey,
    label: v.string(),
    kind: v.literal('option'),
    options: v.array(OptionMeta),
  }),
]);
export type AttributeMeta = v.InferOutput<typeof AttributeMeta>;

/** Whether `value` is one an attribute of this kind holds. */
function holds(attribute: AttributeMeta, value: Scalar): boolean {
  switch (attribute.kind) {
    case 'text':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'option':
      return attribute.options.some((option) => option.value === value);
  }
}

/** The first value that comes twice in the list, at its second place. */
function repeated(values: readonly string[]): { value: string; at: number } | undefined {
  const seen = new Set<string>();
  for (const [at, value] of values.entries()) {
    if (seen.has(value)) {
      return { value, at };
    }
    seen.add(value);
  }
  return undefined;
}

/**
 * An option field's settings: its options, each value once; its attributes,
 * each key once; and on each option only declared attributes, each null or a
 * value of its attribute's kind (an option attribute's one of its options).
 */
export const optionSettings = v.pipe(
  v.strictObject({
    /** In their order. */
    options: v.array(OptionMeta),
    /** What its options carry besides a label. */
    attributes: v.optional(v.array(AttributeMeta)),
  }),
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed) {
      return;
    }
    const { options, attributes = [] } = dataset.value;
    const issue = (message: string, ...keys: (string | number)[]) => {
      addIssue({ message, path: pathTo(dataset.value, keys) });
    };
    const twice = repeated(options.map((option) => option.value));
    if (twice) {
      issue(`two options are "${twice.value}"`, 'options', twice.at, 'value');
    }
    const twiceKey = repeated(attributes.map((attribute) => attribute.key));
    if (twiceKey) {
      issue(`two attributes are "${twiceKey.value}"`, 'attributes', twiceKey.at, 'key');
    }
    for (const [a, attribute] of attributes.entries()) {
      if (attribute.kind !== 'option') {
        continue;
      }
      const twiceNested = repeated(attribute.options.map((option) => option.value));
      if (twiceNested) {
        issue(
          `two options of "${attribute.key}" are "${twiceNested.value}"`,
          'attributes',
          a,
          'options',
          twiceNested.at,
          'value',
        );
      }
    }
    for (const [o, option] of options.entries()) {
      for (const [key, value] of Object.entries(option.attributes ?? {})) {
        const attribute = attributes.find((declared) => declared.key === key);
        if (!attribute) {
          issue(`no attribute "${key}"`, 'options', o, 'attributes', key);
        } else if (value !== null && !holds(attribute, value)) {
          issue(
            attribute.kind === 'option'
              ? `"${key}" has no option "${String(value)}"`
              : `"${key}" holds a ${attribute.kind}`,
            'options',
            o,
            'attributes',
            key,
          );
        }
      }
    }
  }),
);

/** A ref field's settings: the resource its ids are rows of. */
export const refSettings = v.strictObject({
  /** The resource its ids are rows of: 'users', 'items', 'projects'. */
  of: v.pipe(v.string(), v.nonEmpty('a ref names the resource it points at')),
});

/** One of the field's options, archived ones too: rows still hold them. */
export function optionValue(settings?: Record<string, Json>): v.GenericSchema<string> {
  const parsed = v.safeParse(optionSettings, settings);
  const values = parsed.success ? parsed.output.options.map((option) => option.value) : [];
  return v.picklist(values, (issue) => `no option ${issue.received}`);
}

/** Whether year, month and day name a day the calendar has (no 31 April). */
function isDay(year: number, month: number, day: number): boolean {
  // setUTCFullYear, unlike Date.UTC, takes years 0 to 99 as they are.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// ISO 8601 in UTC, as Date#toISOString writes it: to the second, its fraction
// optional, and Z.
const DATETIME = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,9})?Z$/;

/** A day's number parts from a match's first three groups; NaN where one's missing. */
function dayOf(match: RegExpExecArray | null): [number, number, number] {
  return [Number(match?.[1]), Number(match?.[2]), Number(match?.[3])];
}

/** '2026-10-12': no time, no zone. */
export const dateValue: v.GenericSchema<string> = v.pipe(
  v.string(),
  v.check((text) => isDay(...dayOf(DATE.exec(text))), 'a date is a day, YYYY-MM-DD'),
);

/** '2026-10-12T09:30:00.000Z': ISO 8601, in UTC. */
export const datetimeValue: v.GenericSchema<string> = v.pipe(
  v.string(),
  v.check(
    (text) => isDay(...dayOf(DATETIME.exec(text))),
    'a datetime is ISO 8601 in UTC, YYYY-MM-DDTHH:mm:ss.sssZ',
  ),
);

const absoluteUrl = v.pipe(v.string(), v.url());

// An origin no url names, to resolve a path against: a path that leaves it
// names another host.
const HERE = 'http://here.invalid';

/**
 * Whether `text` is a path from the root: '/api/users/7/avatar'. Never
 * '//host/x', nor what a browser reads as it ('/\host/x', a tab or a newline
 * between the slashes), since it names another host; never a relative 'x/y'.
 */
function isRootPath(text: string): boolean {
  if (!text.startsWith('/')) {
    return false;
  }
  try {
    return new URL(text, HERE).origin === HERE;
  } catch {
    return false;
  }
}

/**
 * A url: absolute, with its scheme ('https://…'), or a path from the root
 * ('/api/users/7/avatar'), which a client resolves against the API's address.
 */
export const urlValue: v.GenericSchema<string> = v.pipe(
  v.string(),
  v.check(
    (text) => v.is(absoluteUrl, text) || isRootPath(text),
    'a url is absolute, with its scheme, or a path from the root',
  ),
);

export const numberValue: v.GenericSchema<number> = finite;

/** A row's id: a string that isn't empty, or a whole number. */
export const idValue: v.GenericSchema<Id> = Id;
