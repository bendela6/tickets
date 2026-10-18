import type {
  AttributeMeta,
  FieldMeta,
  Filter,
  KindRegistry,
  KindSpec,
  OperatorRegistry,
  OptionMeta,
  ResourceMeta,
} from '@bh/resource';
import type { AsyncResolver } from '../types/async-config';
import type { FormConfig } from '../types/form-config';
import type { LayoutNode } from '../types/layout-node';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { entriesOf, type FilterField, isCondition, pathOf } from './conditions';

// What a filter form takes from the resource's metadata: each field's label
// and options, checked against what the resource lets be filtered. Pure, so
// the fill and its refusals are tested without drawing anything.

/** A choice a filter field offers: an option of the resource's, a preset, a ref's row. */
export interface FilterOption {
  /** What the field holds for it, and the operand it writes: `'in-progress'`. */
  value: string;
  /** How it reads: `'In progress'`. */
  label: string;
  /** A bh tone, as an option's in the metadata: `'blue'`, `'success'`. */
  color?: string;
  /** How many rows picking it would show, when the field's config asks for counts. */
  count?: number;
}

/** What a filter form's fields are filled from. */
export interface FilterMeta {
  /** The resource's metadata: its fields, and what each lets be filtered. */
  meta: ResourceMeta;
  /** The operators its fields are filtered by: bh's and the app's own. */
  operators: OperatorRegistry;
  /** The kinds its fields are of: bh's and the app's own. */
  kinds: KindRegistry;
  /** A ref field's rows, from the resource it names, the first page of those matching `text`. */
  optionsFor?: (resource: string, text: string) => Promise<FilterOption[]>;
}

/** What a fill puts on the options besides the metadata's. */
export interface FillState {
  /** Each field's counts, by its name, then by option value. */
  counts?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** What each field holds: an archived option a field holds stays offered. */
  values?: Readonly<Record<string, unknown>>;
}

/** What a path reaches: a field, or an attribute of an option field's options. */
interface Target {
  field: FieldMeta;
  attribute?: AttributeMeta;
  kind: KindSpec;
}

// bh's two operators that compare one value with one value: a field holding a
// list isn't filtered by them, as the query's own check says (queryOf).
const ONE_TO_ONE = new Set(['equals', 'notEquals']);

/** The attributes an option field's options carry. */
function attributesOf(field: FieldMeta): AttributeMeta[] {
  const attributes = field.type.settings?.attributes;
  return Array.isArray(attributes) ? (attributes as AttributeMeta[]) : [];
}

/** What `path` reaches in the metadata, or why it reaches nothing. */
function targetOf(source: FilterMeta, path: string): Target | string {
  const [key = '', name] = path.split('.');
  const field = source.meta.fields.find((each) => each.key === key);
  if (!field) {
    return `${source.meta.resource} has no field "${key}"`;
  }
  const attribute =
    name === undefined ? undefined : attributesOf(field).find((each) => each.key === name);
  if (name !== undefined && !attribute) {
    return `"${key}" has no attribute "${name}"`;
  }
  const kindName = attribute?.kind ?? field.type.kind;
  const kind = source.kinds.has(kindName) ? source.kinds.get(kindName) : undefined;
  if (!kind) {
    return `no kind "${kindName}" is registered`;
  }
  return { field, kind, ...(attribute ? { attribute } : {}) };
}

/** Why `path` can't be filtered by `op`, or undefined when it can. */
function refusal(source: FilterMeta, path: string, op: string): string | undefined {
  const target = targetOf(source, path);
  if (typeof target === 'string') {
    return target;
  }
  if (target.field.query.filter.length === 0) {
    return `"${target.field.key}" can't be filtered`;
  }
  if (!source.operators.has(op)) {
    return `no operator "${op}" is registered`;
  }
  const allowed =
    target.field.query.filter.includes(op) &&
    target.kind.operators.includes(op) &&
    !(target.field.type.many === true && ONE_TO_ONE.has(op));
  return allowed ? undefined : `"${path}" can't be filtered by "${op}"`;
}

/** Throws, naming the field, when a filter it writes isn't one the resource allows. */
function check(source: FilterMeta, node: FilterField, conditions: { path: string; op: string }[]) {
  for (const { path, op } of conditions) {
    const why = refusal(source, path, op);
    if (why !== undefined) {
      throw new Error(`FilterForm: the field "${node.name}" filters "${path}" by "${op}": ${why}.`);
    }
  }
}

/** Every condition in a filter, groups' too. */
function conditionsIn(filter: Filter): { path: string; op: string }[] {
  if (isCondition(filter)) {
    return [{ path: filter.field, op: filter.op }];
  }
  if ('not' in filter) {
    return conditionsIn(filter.not);
  }
  return ('any' in filter ? filter.any : filter.all).flatMap(conditionsIn);
}

/** The conditions a field writes: its own, or its presets'. */
function conditionsOf(node: FilterField): { path: string; op: string }[] {
  const filter = node.filter;
  if ('op' in filter) {
    return [{ path: pathOf(node), op: filter.op }];
  }
  if ('range' in filter) {
    return filter.range.map((op) => ({ path: pathOf(node), op }));
  }
  if ('presets' in filter) {
    return filter.presets.flatMap((preset) => entriesOf(preset.filter).flatMap(conditionsIn));
  }
  return [];
}

/** Whether a field's value holds this option: one value, or a list of them. */
function holds(value: unknown, option: string): boolean {
  return Array.isArray(value) ? value.includes(option) : value === option;
}

/** The metadata's options as a filter offers them: in their order, archived ones only when held. */
function optionsOf(list: readonly OptionMeta[], value: unknown): FilterOption[] {
  return [...list]
    .sort((a, b) => a.order - b.order)
    .filter((option) => option.archived !== true || holds(value, option.value))
    .map((option) => {
      return {
        value: option.value,
        label: option.label,
        ...(option.color === undefined ? {} : { color: option.color }),
      };
    });
}

/** The options a path's field or attribute offers; undefined for a kind without options. */
function metaOptions(target: Target, value: unknown): FilterOption[] | undefined {
  if (target.attribute) {
    return target.attribute.kind === 'option'
      ? optionsOf(target.attribute.options, value)
      : undefined;
  }
  if (target.field.type.kind !== 'option') {
    return undefined;
  }
  const options = target.field.type.settings?.options;
  return Array.isArray(options) ? optionsOf(options as OptionMeta[], value) : undefined;
}

/** The resource a ref field's rows come from: its `of`. */
function refOf(field: FieldMeta): string | undefined {
  const of = field.type.kind === 'ref' ? field.type.settings?.of : undefined;
  return typeof of === 'string' ? of : undefined;
}

/**
 * Puts each option's count on it, once the field's counts are in: 0 for an
 * option they leave out, as a grouped count has no group for no rows.
 */
function counted(options: FilterOption[], counts: Readonly<Record<string, number>> | undefined) {
  if (!counts) {
    return options;
  }
  return options.map((option) => {
    return { ...option, count: counts[option.value] ?? 0 };
  });
}

/** One filter field, filled: its label, its options, and a rules field's metadata. */
function fillField(source: FilterMeta, node: FilterField, state: FillState): FilterField {
  check(source, node, conditionsOf(node));
  const filter = node.filter;
  const config = node.config as Record<string, unknown>;
  const counts = config.counts === true ? state.counts?.[node.name] : undefined;
  const value = state.values?.[node.name];
  const out: Record<string, unknown> = { ...config };

  if ('rules' in filter) {
    const { optionsFor } = source;
    out.fields ??= source.meta.fields.filter((field) => field.query.filter.length > 0);
    out.operators ??= source.operators;
    out.kinds ??= source.kinds;
    if (optionsFor && out.optionsFor === undefined) {
      out.optionsFor = (field: FieldMeta) => {
        const of = refOf(field);
        return of === undefined ? Promise.resolve([]) : optionsFor(of, '');
      };
    }
    return { ...node, config: out };
  }

  if ('presets' in filter) {
    out.options ??= counted(
      filter.presets.map((preset) => ({ value: preset.value, label: preset.label })),
      counts,
    );
    return { ...node, config: out };
  }

  // A field of one path: an `{ op }` or a `{ range }`.
  const target = targetOf(source, pathOf(node)) as Target;
  const label = node.label ?? target.field.label;
  if (out.options === undefined) {
    const of = target.attribute ? undefined : refOf(target.field);
    const own = metaOptions(target, value);
    if (own) {
      out.options = counted(own, counts);
    } else if (of !== undefined && source.optionsFor) {
      // Loaded once, as the form's async config is: the field shows it loads.
      const optionsFor = source.optionsFor;
      out.options = {
        fn: () => optionsFor(of, ''),
        dependsOn: [],
      } satisfies AsyncResolver<FilterOption[]>;
    } else if ('op' in filter && filter.map) {
      out.options = counted(
        Object.keys(filter.map).map((key) => ({ value: key, label: key })),
        counts,
      );
    }
  }
  return { ...node, label, config: out };
}

/** Fills each node of a list, and each layout's children. */
function fillNodes(
  nodes: readonly LayoutNode<InputRegistry, LayoutComponentRegistry>[],
  source: FilterMeta,
  state: FillState,
): LayoutNode<InputRegistry, LayoutComponentRegistry>[] {
  return nodes.map((node) => {
    if (node.kind === 'field') {
      const field = node as FilterField;
      return field.filter === undefined ? node : fillField(source, field, state);
    }
    if ('children' in node) {
      return { ...node, children: fillNodes(node.children, source, state) };
    }
    return node;
  });
}

/**
 * A filter form's config with what each field takes from the resource's
 * metadata, by the field or path its `filter` names (its own name when it
 * names none):
 *
 * - its label, unless it has one;
 * - its options, unless its config gives some: an option field's, in their
 *   order with their colors, archived ones only while the field holds them;
 *   an option attribute's (`status.kind`); a ref field's rows, through
 *   `optionsFor`, as an async config key; else a `map`'s keys. A presets
 *   field offers its presets;
 * - with `counts: true` in its config, each option's count from `state`;
 * - a `rules` field, the filterable fields, the operators, the kinds and
 *   `optionsFor`.
 *
 * Throws, naming the field, when a filter it writes names a field or an
 * attribute the metadata lacks, a field that can't be filtered, or an
 * operator nothing registered or that the field's kind or its `query.filter`
 * doesn't allow.
 */
export function fillFilterForm<I extends InputRegistry, L extends LayoutComponentRegistry>(
  form: FormConfig<I, L>,
  source: FilterMeta,
  state: FillState = {},
): FormConfig<I, L> {
  const nodes = form.nodes as unknown as LayoutNode<InputRegistry, LayoutComponentRegistry>[];
  return {
    ...form,
    nodes: fillNodes(nodes, source, state),
  };
}
