import type { Filter, Scalar } from '@bh/resource';
import type { CommitChange } from '../types/commit';
import { type FilterField, type FilterOptions, entriesOf, pathOf, sameFilter } from './conditions';
import { type AnyNodes, filterFields, foldFilter, presetNames } from './fold';

/** Whether a list holds this entry. */
function holds(list: readonly Filter[], entry: Filter): boolean {
  return list.some((each) => sameFilter(each, entry));
}

/** What one field's value writes, alone. */
function writes(field: FilterField, value: unknown, options: FilterOptions): Filter[] {
  const folded = foldFilter([field], { [field.name]: value }, options).filter;
  return 'all' in folded ? folded.all : [folded];
}

/**
 * What a field holds for no condition: its map's key for `null`, else its
 * empty value, else the empty value of what it holds now's kind.
 */
function noCondition(field: FilterField, now: unknown, options: FilterOptions): unknown {
  const own = field.filter;
  if ('op' in own && own.map) {
    const off = Object.keys(own.map).find((key) => own.map?.[key] === null);
    if (off !== undefined) {
      return off === 'true' ? true : off === 'false' ? false : off;
    }
  }
  if (options.emptyOf) {
    return options.emptyOf(field);
  }
  if (Array.isArray(now)) {
    return [];
  }
  if (typeof now === 'string') {
    return '';
  }
  return typeof now === 'boolean' ? false : null;
}

/** A field's value with the dropped conditions let go, or the same value when it held none. */
function letGo(
  field: FilterField,
  now: unknown,
  dropped: readonly Filter[],
  options: FilterOptions,
): unknown {
  const own = field.filter;
  if ('rules' in own) {
    const list = Array.isArray(now) ? (now as Filter[]) : [];
    const kept = list.filter((entry) => !holds(dropped, entry));
    return kept.length === list.length ? now : kept;
  }
  if ('presets' in own) {
    const on = presetNames(now);
    const off = own.presets.filter((preset) => {
      return (
        on.has(preset.value) && entriesOf(preset.filter).some((entry) => holds(dropped, entry))
      );
    });
    if (off.length === 0) {
      return now;
    }
    if (Array.isArray(now)) {
      return now.filter((name) => !off.some((preset) => preset.value === name));
    }
    // One preset: the first that sets nothing, as an "All", else none.
    const none = own.presets.find((preset) => entriesOf(preset.filter).length === 0);
    return none?.value ?? noCondition(field, now, options);
  }
  if ('range' in own) {
    const halves = Array.isArray(now) ? [...(now as unknown[])] : [];
    let changed = false;
    own.range.forEach((op, index) => {
      const half = halves[index];
      const condition = { field: pathOf(field), op, value: half as Scalar };
      if (half !== null && half !== undefined && holds(dropped, condition)) {
        halves[index] = null;
        changed = true;
      }
    });
    return changed ? halves : now;
  }
  const wrote = writes(field, now, options);
  return wrote.some((entry) => holds(dropped, entry)) ? noCondition(field, now, options) : now;
}

/**
 * Lets every field go of a condition one field just dropped, so removing a
 * condition from one field removes it from all. Run on each commit: when the
 * committed field's new value no longer writes a condition its old value
 * wrote, every other field holding that condition lets it go. A preset turns
 * off (a field holding one preset goes to the one that sets nothing, as an
 * "All", else to none), an `{ op }` field takes its value for no condition, a
 * range the half, and the `rules` list loses it.
 *
 * Turning presets off in a field holding a list of them lets go of all their
 * conditions, so another preset of the field holding one turns off too.
 * Unpicking Blocked in the status chips turns a "Blocked" preset off too.
 * Returns the values, a new object when anything let go.
 */
export function dropShared(
  nodes: AnyNodes,
  values: Record<string, unknown>,
  change: CommitChange,
  options: FilterOptions = {},
): Record<string, unknown> {
  const fields = filterFields(nodes);
  const changed = fields.find((field) => field.name === change.field);
  if (!changed) {
    return values;
  }
  const after = writes(changed, change.value, options);
  const dropped = writes(changed, change.previous, options).filter((entry) => !holds(after, entry));
  // Presets turned off in a list of them let go of all their conditions, so
  // another preset of the field still holding one turns off too.
  const own = changed.filter;
  const many = 'presets' in own && Array.isArray(change.value);
  if (many) {
    const still = presetNames(change.value);
    for (const preset of own.presets) {
      if (presetNames(change.previous).has(preset.value) && !still.has(preset.value)) {
        for (const entry of entriesOf(preset.filter)) {
          if (!holds(dropped, entry)) {
            dropped.push(entry);
          }
        }
      }
    }
  }
  if (dropped.length === 0) {
    return values;
  }
  let out = values;
  for (const field of fields) {
    const self = field.name === changed.name;
    if ((self && !many) || !Object.hasOwn(values, field.name)) {
      continue;
    }
    const now = values[field.name];
    const next = letGo(field, now, dropped, options);
    if (next !== now) {
      out = out === values ? { ...values } : out;
      out[field.name] = next;
    }
  }
  return out;
}
