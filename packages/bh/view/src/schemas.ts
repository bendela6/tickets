import * as v from 'valibot';
import { Json } from '@bh/resource';
import type { AnyLayouts, Layouts, TemplateNode } from '@bh/template';

// What the view's shapes share: a name, a width in pixels, a JSON object, a
// template a host holds, and the path a check reports a problem at.

/** A name a view, a column or a state names something by: not empty. */
export function nameOf(message: string) {
  return v.pipe(v.string(), v.nonEmpty(message));
}

/** A width in pixels: more than 0. */
export const pixels = v.pipe(
  v.number(),
  v.finite('a width is a number of pixels'),
  v.gtValue(0, 'a width is more than 0 pixels'),
);

/**
 * An object of string keys, each value checked by `value`, and never a list,
 * which valibot's record would take as an object of its indexes.
 */
export function recordOf<T extends v.GenericSchema>(value: T, message: string) {
  const record = v.record(v.string(), value, message);
  const list = v.custom<never>(() => false, message);
  return v.lazy((input) => {
    return Array.isArray(input) ? list : record;
  });
}

/** A JSON object: string keys, JSON values, no functions. */
export function jsonObject(message: string) {
  return recordOf(Json, message);
}

/** Whether `input` is an object holding `key`. */
export function holding(input: unknown, key: string): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && Object.hasOwn(input, key);
}

/** Whether a list holds each of its values once. */
export function once(values: string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Whether a JSON object is a template's node by its keys: a layout node,
 * naming its layout and holding nodes; or a part, showing one of a field, a
 * value and a text.
 */
function isNode(node: Record<string, Json>): boolean {
  const shows = ['field', 'value', 'text'].filter((key) => Object.hasOwn(node, key));
  return Object.hasOwn(node, 'layout')
    ? typeof node.layout === 'string' && Array.isArray(node.nodes) && shows.length === 0
    : shows.length === 1;
}

/**
 * A template a host holds (a column's cell, a list item's body): JSON, and a
 * template's node at its root. What its parts and layouts hold is the
 * template's to check against its registries and the resource
 * (validateTemplate, TK-79.8), which validateView (TK-16.5) runs on each.
 */
const template = v.pipe(
  jsonObject('a template is a JSON object'),
  v.check(
    isNode,
    'a template is a part showing a field, a value or a text, or a layout node holding nodes',
  ),
);

/**
 * The template's schema, typed with the layouts `L` its nodes may name: the
 * app's, which only validateTemplate checks against its registry.
 */
export function templateOf<L extends Layouts<L> = AnyLayouts>(): v.GenericSchema<
  unknown,
  TemplateNode<L>
> {
  return template as unknown as v.GenericSchema<unknown, TemplateNode<L>>;
}

/** The path to a value inside `root` by its keys and indexes, as a valibot issue names it. */
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

/**
 * A list whose entries are each named once by a key inside them: a view's
 * columns by `fixed.key`, a state's by `key`. The second of two is refused, at
 * its key.
 */
export function namedOnce<T>(
  list: v.GenericSchema<unknown, T[]>,
  keyOf: (entry: T) => { key: string; at: readonly string[] },
  message: (key: string) => string,
): v.GenericSchema<unknown, T[]> {
  return v.pipe(
    list,
    v.rawCheck<T[]>(({ dataset, addIssue }) => {
      if (!dataset.typed) {
        return;
      }
      const seen = new Set<string>();
      dataset.value.forEach((entry, index) => {
        const { key, at } = keyOf(entry);
        if (seen.has(key)) {
          addIssue({ message: message(key), path: pathTo(dataset.value, [index, ...at]) });
        }
        seen.add(key);
      });
    }),
  );
}
