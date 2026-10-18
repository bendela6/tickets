import * as v from 'valibot';
import {
  valueAt,
  type FieldMeta,
  type Json,
  type KindSpec,
  type Registry,
  type ResourceMeta,
  type Row,
  type Scalar,
  type Sort,
} from '@bh/resource';

// How rows order where bh holds them itself, by the contract's rule: each
// sort key by its kind's own order (KindSpec.compare), rows without a value
// last both ways, and the id breaking ties, so the order is total.

/** What orders one path's values: its kind's compare and the settings it reads. */
export interface Orderer {
  compare: (a: Scalar, b: Scalar) => number;
}

/** The option field's settings, as its kind's schema takes them. */
function optionsOf(field: FieldMeta, registry: Registry) {
  const kind = registry.kinds.has('option') ? registry.kinds.get('option') : undefined;
  const parsed = kind?.settings ? v.safeParse(kind.settings, field.type.settings) : undefined;
  return parsed?.success
    ? (parsed.output as {
        options: { value: string }[];
        attributes?: { key: string; kind: string; options?: unknown[] }[];
      })
    : undefined;
}

/**
 * What orders the values a path reads: a field's kind, or an option field's
 * attribute's ('status.kind'), an option attribute by its own options' order.
 * Undefined when nothing orders them alone.
 */
export function ordererOf(
  path: string,
  meta: ResourceMeta,
  registry: Registry,
): Orderer | undefined {
  const [key = '', name] = path.split('.');
  const field = meta.fields.find((each) => each.key === key);
  if (!field) {
    return undefined;
  }
  const kindNamed = (kind: string): KindSpec | undefined => {
    return registry.kinds.has(kind) ? registry.kinds.get(kind) : undefined;
  };
  if (name === undefined) {
    const kind = kindNamed(field.type.kind);
    const compare = kind?.compare;
    return compare && { compare: (a, b) => compare(a, b, field.type.settings) };
  }
  const attribute = optionsOf(field, registry)?.attributes?.find((each) => each.key === name);
  const kind = attribute && kindNamed(attribute.kind);
  const compare = kind?.compare;
  if (!attribute || !compare) {
    return undefined;
  }
  const settings = attribute.options
    ? ({ options: attribute.options } as Record<string, Json>)
    : undefined;
  return { compare: (a, b) => compare(a, b, settings) };
}

/** Two ids in order: numbers by value, text alphabetically. */
function byId(a: Json | undefined, b: Json | undefined): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  const [x, y] = [String(a), String(b)];
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Whether a read value is none: null, or a list a single sort key never reads. */
function isNone(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * The order of `sort`, then the id: each key by its kind's order, a row
 * without a value last both ways. A key nothing orders alone is passed
 * over, as queryOf never lets one through.
 */
export function rowOrder(
  sort: readonly Sort[],
  meta: ResourceMeta,
  registry: Registry,
): (a: Row, b: Row) => number {
  const keys = sort.flatMap(({ field, dir }) => {
    const orderer = ordererOf(field, meta, registry);
    return orderer ? [{ field, sign: dir === 'desc' ? -1 : 1, orderer }] : [];
  });
  const id = meta.roles.idField;
  return (a, b) => {
    for (const { field, sign, orderer } of keys) {
      const [x, y] = [valueAt(field, a, meta), valueAt(field, b, meta)];
      if (isNone(x) || isNone(y)) {
        if (isNone(x) !== isNone(y)) {
          return isNone(x) ? 1 : -1;
        }
        continue;
      }
      if (Array.isArray(x) || Array.isArray(y)) {
        continue;
      }
      const at = orderer.compare(x, y);
      if (at !== 0) {
        return sign * at;
      }
    }
    return byId(a[id], b[id]);
  };
}
