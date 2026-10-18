import * as v from 'valibot';
import {
  type Filter,
  type Group,
  type GroupBy,
  type Registry,
  type ResourceMeta,
  type Row,
  type Scalar,
  valueAt,
} from '@bh/resource';
import { refuse } from '../adapter/errors';
import type { Counted } from '../types/query';
import { ordererOf } from './order';

// A grouped query's groups: counted in memory for a source bh holds whole,
// or by the source itself; then, either way, the groups no row holds where
// a query asks for all of them, in the field's order, each with the filter
// that picks its rows.

/** Each group's rows, counted: a row of a many field in each value's group, none in null's. */
export function countGroups(rows: readonly Row[], by: GroupBy, meta: ResourceMeta): Counted[] {
  const counts = new Map<string, Counted>();
  for (const row of rows) {
    const value = valueAt(by.field, row, meta);
    const keys: (Scalar | null)[] = Array.isArray(value) ? value : [value];
    for (const key of keys.length > 0 ? keys : [null]) {
      const at = JSON.stringify(key);
      const group = counts.get(at) ?? { key, count: 0 };
      group.count += 1;
      counts.set(at, group);
    }
  }
  return [...counts.values()];
}

/** The keys a field or a path's groups may have, for `all`: the groups no row holds too. */
function everyKey(path: string, meta: ResourceMeta, registry: Registry): Scalar[] {
  const [key = '', name] = path.split('.');
  const field = meta.fields.find((each) => each.key === key);
  const option = registry.kinds.has('option') ? registry.kinds.get('option') : undefined;
  const parsed =
    field?.type.kind === 'option' && option?.settings
      ? v.safeParse(option.settings, field.type.settings)
      : undefined;
  const settings = parsed?.success
    ? (parsed.output as {
        options: { value: string; archived?: true }[];
        attributes?: { key: string; kind: string; options?: { value: string }[] }[];
      })
    : undefined;
  if (name !== undefined) {
    const attribute = settings?.attributes?.find((each) => each.key === name);
    if (attribute?.kind === 'boolean') {
      return [false, true];
    }
    return attribute?.options?.map((each) => each.value) ?? [];
  }
  if (field?.type.kind === 'boolean') {
    return [false, true];
  }
  if (field?.type.kind === 'ref') {
    return refuse(
      'the groups no row holds are the rows a ref points at, which this source can’t list',
      ['group', 'all'],
    );
  }
  // An archived option is offered for no new value: its column shows only while rows hold it.
  return settings?.options.filter((each) => !each.archived).map((each) => each.value) ?? [];
}

/** The filter that picks a group's rows: equals its key, in [key] on a list, empty for null. */
function groupFilter(path: string, key: Scalar | null, meta: ResourceMeta): Filter {
  if (key === null) {
    return { field: path, op: 'empty' };
  }
  const field = meta.fields.find((each) => each.key === path.split('.')[0]);
  return field?.type.many
    ? { field: path, op: 'in', value: [key] }
    : { field: path, op: 'equals', value: key };
}

/**
 * The groups of a grouped query: the counted ones, with those no row holds
 * when it asks for `all`, in the field's order (`dir`), the rows holding none
 * last; each with the filter that picks its rows.
 */
export function groupsOf(
  counted: readonly Counted[],
  by: GroupBy,
  meta: ResourceMeta,
  registry: Registry,
): Group[] {
  const groups = new Map(counted.map((group) => [JSON.stringify(group.key), group]));
  if (by.all) {
    for (const key of everyKey(by.field, meta, registry)) {
      const at = JSON.stringify(key);
      if (!groups.has(at)) {
        groups.set(at, { key, count: 0 });
      }
    }
  }
  const orderer = ordererOf(by.field, meta, registry);
  const sign = by.dir === 'desc' ? -1 : 1;
  const ordered = [...groups.values()].sort((a, b) => {
    if (a.key === null || b.key === null) {
      return a.key === b.key ? 0 : a.key === null ? 1 : -1;
    }
    const at = orderer ? orderer.compare(a.key, b.key) : String(a.key) < String(b.key) ? -1 : 1;
    return sign * at;
  });
  return ordered.map(({ key, count }) => {
    return {
      key,
      count,
      filter: groupFilter(by.field, key, meta),
    };
  });
}
