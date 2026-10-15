import * as v from 'valibot';
import { valueAt } from './matches';
import type { ResourceMeta } from './meta';
import type { Sort } from './query';
import type { Registry } from './registry';
import { optionSettings } from './schemas';
import type { FieldMeta, KindSpec } from './types';
import type { Id, Json, Row, Scalar } from './values';

// The contract's order (Sort) as a comparator of rows, in plain JavaScript:
// each key by its kind's own order (KindSpec.compare), an option by its
// `order`, a ref by the title of the row it points at; rows without a value
// last, both ways; and the id breaking ties, so the order is total. A client
// puts a row it just wrote in its place in a list it holds by it (TK-12.3).

/**
 * The title of the row a ref points at, by the resource its field names
 * (`type.settings.of`) and the row's id: what that resource's
 * `roles.titleField` holds. Undefined when it isn't known here.
 */
export type TitleOf = (resource: string, id: Id) => string | undefined;

/** What rowOrder needs beyond the sort, the metadata and the registry. */
export interface OrderOptions {
  /**
   * The titles a ref orders by. Without it a ref doesn't order here, and
   * rowOrder answers undefined for a sort by one.
   */
  titleOf?: TitleOf;
}

/** How one key's values order: two in order, and whether one has a place at all. */
interface KeyOrder {
  /** Below 0 when `a` comes first; both have a place. */
  compare: (a: Scalar, b: Scalar) => number;
  /** Whether the value has a place: false for a ref whose title isn't known, which orders as none. */
  placed: (value: Scalar) => boolean;
}

/** Where `a` sits against `b`: below 0 before it, 0 with it, above 0 after it. */
function sign<T>(a: T, b: T): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function kindNamed(registry: Registry, name: string): KindSpec | undefined {
  return registry.kinds.find((spec) => spec.name === name);
}

const everywhere = () => true;

/** Text alphabetically, case ignored: the text kind's order, which a ref's title takes. */
function textOrder(registry: Registry): (a: string, b: string) => number {
  const compare = kindNamed(registry, 'text')?.compare;
  return compare ? (a, b) => compare(a, b) : (a, b) => sign(a.toLowerCase(), b.toLowerCase());
}

/** A ref's order: by the title of the row it points at, as `titleOf` knows it. */
function refOrder(of: string, titleOf: TitleOf, registry: Registry): KeyOrder {
  const byText = textOrder(registry);
  const title = (value: Scalar) => titleOf(of, value as Id);
  return {
    compare: (a, b) => byText(title(a) ?? '', title(b) ?? ''),
    placed: (value) => title(value) !== undefined,
  };
}

/** The order of an option field's attribute, by its kind's; its own options' for an option one. */
function attributeOrder(field: FieldMeta, name: string, registry: Registry): KeyOrder | undefined {
  if (field.type.kind !== 'option') {
    return undefined;
  }
  const parsed = v.safeParse(optionSettings, field.type.settings);
  const attribute = parsed.success
    ? parsed.output.attributes?.find((each) => each.key === name)
    : undefined;
  const compare = attribute && kindNamed(registry, attribute.kind)?.compare;
  if (!attribute || !compare) {
    return undefined;
  }
  const settings =
    attribute.kind === 'option'
      ? ({ options: attribute.options } as unknown as Record<string, Json>)
      : undefined;
  return { compare: (a, b) => compare(a, b, settings), placed: everywhere };
}

/**
 * What orders the values one key reads, or undefined when nothing orders
 * them here: a field's kind, or an option field's attribute's
 * ('status.kind'); a ref by its title.
 */
function keyOrder(
  path: string,
  meta: ResourceMeta,
  registry: Registry,
  titleOf: TitleOf | undefined,
): KeyOrder | undefined {
  const [key = '', name] = path.split('.');
  const field = meta.fields.find((each) => each.key === key);
  if (!field) {
    return undefined;
  }
  if (name !== undefined) {
    return attributeOrder(field, name, registry);
  }
  if (field.type.kind === 'ref') {
    const of = field.type.settings?.['of'];
    return titleOf && typeof of === 'string' ? refOrder(of, titleOf, registry) : undefined;
  }
  const compare = kindNamed(registry, field.type.kind)?.compare;
  return compare && { compare: (a, b) => compare(a, b, field.type.settings), placed: everywhere };
}

/** Whether a read value is none: null, or a key the row doesn't hold. */
function isNone(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Two ids in order, as every adapter breaks a tie: a number by value, text
 * by code point (Postgres' "C" collation), case kept.
 */
function byId(a: Json, b: Json): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return sign(String(a), String(b));
}

/**
 * The contract's order of `sort` as a comparator of rows, then the id (a
 * number by value, text by code point), so the order is total: each key by
 * its kind's order (KindSpec.compare), an
 * attribute's path by its attribute's, an option by its `order`, a ref by the
 * title of the row it points at (`titleOf`); a row without a value comes
 * last, both ways, as does a ref whose title `titleOf` doesn't know.
 *
 * Undefined when a key can't be ordered here: a field there isn't, a kind
 * without a `compare` (json; an app's own that brings none), a ref without
 * `titleOf`. A list doesn't sort: a key that reads one is passed over, as
 * queryOf never lets a sort by one through.
 */
export function rowOrder(
  sort: readonly Sort[],
  meta: ResourceMeta,
  registry: Registry,
  options: OrderOptions = {},
): ((a: Row, b: Row) => number) | undefined {
  const keys: { field: string; direction: number; order: KeyOrder }[] = [];
  for (const { field, dir } of sort) {
    const order = keyOrder(field, meta, registry, options.titleOf);
    if (!order) {
      return undefined;
    }
    keys.push({ field, direction: dir === 'desc' ? -1 : 1, order });
  }
  const id = meta.roles.idField;
  return (a, b) => {
    for (const { field, direction, order } of keys) {
      const [x, y] = [valueAt(field, a, meta), valueAt(field, b, meta)];
      if (Array.isArray(x) || Array.isArray(y)) {
        continue;
      }
      const [noX, noY] = [isNone(x) || !order.placed(x), isNone(y) || !order.placed(y)];
      if (noX || noY) {
        // A value before none, both ways.
        if (noX !== noY) {
          return noX ? 1 : -1;
        }
        continue;
      }
      const at = order.compare(x as Scalar, y as Scalar);
      if (at !== 0) {
        return direction * at;
      }
    }
    return byId(a[id] ?? null, b[id] ?? null);
  };
}
