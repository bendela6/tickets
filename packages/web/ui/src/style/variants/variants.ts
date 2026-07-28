import { clsx, type ClassValue } from 'clsx';
import { cn } from '../cn';
import { isExpansion, type Axis, type Expansion } from './axis';

/**
 * CVA-like class builder. The whole call is one object: a `base` and a `config`
 * of variant groups. Each group carries a `default` option and an `options` map
 * from option names to the classes they apply. An option is either a class
 * value, or an `over()` expansion that varies over one or more named axes.
 *
 *   const badgeClass = variants({
 *     base: 'inline-flex',
 *     config: {
 *       variant: {
 *         default: 'soft',
 *         options: {
 *           soft: over(TONE, (t) => `bg-${t.bgSubtle} text-${t.text}`),
 *           bare: 'bg-transparent',
 *         },
 *       },
 *       size: { default: 'md', options: { sm: 'h-7', md: 'h-9' } },
 *     },
 *   });
 *
 * An axis carries its own name, domain and resting value, so the group states
 * no params: they are read off the options, and the axis name becomes a public
 * prop (`badgeClass({ variant: 'soft', scale: 'red' })`).
 *
 * At build time every expansion is walked over its whole domain and the result
 * recorded in a module registry — `collectSafelist()` returns it so the
 * Tailwind build emits classes that appear nowhere as literal text.
 *
 * A group may still declare `params` and compute `options` from them. Nothing
 * uses that form any more; it is kept only until the last caller is gone.
 */

/** Maps option names (e.g. `soft`, `md`) to the classes they apply. Values
 *  accept anything `cn` does — a string, or an array of strings — or an
 *  `over()` expansion, which stands for one set of classes per combination of
 *  the axes it declares. */
type ClassMap = Record<string, ClassValue | Expansion>;

/** A group's options: a static option map, or one computed from the params. */
type OptionSource = ClassMap | ((params: never) => ClassMap);

/** One param's authored entry: its default value and the runtime values it can
 *  take (the latter used to expand the safelist). */
interface ParamSpec {
  default?: unknown;
  values?: readonly unknown[];
}

/** A variant group: its option source, an optional default selection, and —
 *  for function groups — the params those options read. */
interface VariantGroup {
  default?: string;
  params?: Record<string, ParamSpec>;
  options: OptionSource;
}

/** A named set of variant groups. */
type Config = Record<string, VariantGroup>;

/** The option names selectable for one group. */
type OptionName<Group extends VariantGroup> = Group['options'] extends (
  params: never,
) => infer Options
  ? keyof Options
  : keyof Group['options'];

/** The params object one group's options function reads (`never` if static). */
type GroupParams<Group extends VariantGroup> = Group['options'] extends (
  params: infer Params,
) => ClassMap
  ? Params
  : never;

/** One optional prop per group, e.g. `{ variant?: 'soft' | 'outline' }`. */
type Selection<Groups extends Config> = {
  [Group in keyof Groups]?: OptionName<Groups[Group]>;
};

/** A group's `params` entries, each keyed and typed to that group's own params
 *  (`Record<string, never>` for a static group, which therefore takes none). */
type ParamSpecs<Params> = [Params] extends [never]
  ? Record<string, never>
  : {
      [Key in keyof Params]?: {
        default?: NonNullable<Params[Key]>;
        values?: readonly NonNullable<Params[Key]>[];
      };
    };

/** Tightens each group's `default` to its own option names and each group's
 *  `params` to its own param shape. Used only in the `extends` constraint —
 *  `Groups` is still inferred from the bare `config` argument, so applying it
 *  here validates the config without breaking inference. */
type ValidGroups<Groups extends Config> = {
  [Group in keyof Groups]: {
    default?: OptionName<Groups[Group]>;
    params?: ParamSpecs<GroupParams<Groups[Group]>>;
    options: Groups[Group]['options'];
  };
};

/** The params a static option map contributes through its `over()` expansions.
 *  Intersected, not unioned: a group whose options vary over different axes
 *  (one over tone, another over size) contributes both props, not a choice
 *  between them. */
type ExpansionParams<Group extends VariantGroup> = Group['options'] extends (
  params: never,
) => ClassMap
  ? never
  : Intersect<
      {
        [Key in keyof Group['options']]: Group['options'][Key] extends Expansion<infer P>
          ? P
          : never;
      }[keyof Group['options']]
    >;

/** Collapses a union of param objects into one object accepting all of them.
 *  The empty union is special-cased: inferring from `never` yields `unknown`,
 *  which would then union into `ParamsOf` and erase every other group's
 *  params instead of contributing nothing. */
type Intersect<Union> = [Union] extends [never]
  ? never
  : (Union extends unknown ? (arg: Union) => void : never) extends (arg: infer Merged) => void
    ? Merged
    : never;

/** Every param any group contributes, from a function group's declaration or
 *  from its options' axes (`never` if there are none). */
type ParamsOf<Groups extends Config> = {
  [Group in keyof Groups]: GroupParams<Groups[Group]> | ExpansionParams<Groups[Group]>;
}[keyof Groups];

/** Adds the params to the props, but only when a group actually uses them. */
type ParamProps<Groups extends Config> = [ParamsOf<Groups>] extends [never]
  ? unknown
  : ParamsOf<Groups>;

/** Collapses an intersection into a single object for readable hovers. */
type Prettify<T> = {
  [Key in keyof T]: T[Key];
};

/** Everything a caller may pass: a choice per group, the params, a className. */
type Props<Groups extends Config> = Prettify<
  Selection<Groups> & ParamProps<Groups> & { className?: string }
>;

/** The selectable axes of a built class function: each group's option names,
 *  and each param's runtime domain. Drives tooling (e.g. Storybook story
 *  generation) from the same config that produces the classes. */
export interface Axes {
  readonly groups: Record<string, readonly string[]>;
  readonly params: Record<string, readonly string[]>;
}

/** A built class function, plus the full set of classes it can ever produce
 *  and the axes it was built from. */
type ClassFn<Groups extends Config> = ((props?: Props<Groups>) => string) & {
  readonly classes: readonly string[];
  readonly axes: Axes;
};

/** Every class produced by any `variants` call, for the Tailwind safelist. */
const SAFELIST = new Set<string>();

/** Returns every class produced across all `variants` calls so far. */
export function collectSafelist(): string[] {
  return [...SAFELIST];
}

/** Splits a class value into individual tokens, skipping `undefined`-laden
 *  ones (a function group called with a param it has no domain for). */
function addTokens(into: Set<string>, value: ClassValue): void {
  for (const token of clsx(value).split(/\s+/)) {
    if (token && !token.includes('undefined')) {
      into.add(token);
    }
  }
}

/** Every combination of param values, e.g. `{ tone }` × N tones. Empty domains
 *  yield a single empty combo so static groups still get walked. */
function paramCombinations(domains: Record<string, readonly string[]>): Record<string, string>[] {
  let combinations: Record<string, string>[] = [{}];
  for (const [key, values] of Object.entries(domains)) {
    const expanded: Record<string, string>[] = [];
    for (const combination of combinations) {
      for (const value of values) {
        expanded.push({ ...combination, [key]: value });
      }
    }
    combinations = expanded;
  }
  return combinations;
}

/** The runtime `values` declared for one group's params, as a domain map.
 *  Values are stringified: a numeric domain (an opacity of `40`) interpolates
 *  identically either way, and keeping the domain textual lets `Axes` describe
 *  itself honestly instead of casting numbers to strings.
 *
 *  Options built with `over()` carry their own axes, so a group whose options
 *  declare them needs no `params` block — the domain is read off the options
 *  instead of restated beside them. */
function groupDomains(group: VariantGroup): Record<string, readonly string[]> {
  const domains: Record<string, readonly string[]> = {};
  for (const [key, spec] of Object.entries(group.params ?? {})) {
    if (spec.values) {
      domains[key] = spec.values.map((value) => String(value));
    }
  }
  for (const ax of groupAxes(group)) {
    domains[ax.name] = ax.keys;
  }
  return domains;
}

/** Every axis any of a group's options varies over, deduped by name. Two
 *  options sharing an axis (the usual case — each variant over the same tone)
 *  contribute it once. */
function groupAxes(group: VariantGroup): Axis[] {
  if (typeof group.options === 'function') {
    return [];
  }
  const byName = new Map<string, Axis>();
  for (const value of Object.values(group.options)) {
    if (isExpansion(value)) {
      for (const ax of value.axes) {
        if (!byName.has(ax.name)) {
          byName.set(ax.name, ax);
        }
      }
    }
  }
  return [...byName.values()];
}

/** The option names of each group. A function group's keys don't depend on the
 *  params (params only shape the class strings), so it's safe to call it with an
 *  empty params object purely to read its option names. */
function collectGroups(config: Config): Record<string, readonly string[]> {
  const groups: Record<string, readonly string[]> = {};
  for (const [name, group] of Object.entries(config)) {
    const optionMap =
      typeof group.options === 'function'
        ? (group.options as (params: Record<string, unknown>) => ClassMap)({})
        : group.options;
    groups[name] = Object.keys(optionMap);
  }
  return groups;
}

/** Expands a config into every class it can produce. Each function group walks
 *  over its own params' combinations; static groups are walked once. */
function enumerateClasses(base: ClassValue, config: Config): string[] {
  const found = new Set<string>();
  addTokens(found, base);
  for (const group of Object.values(config)) {
    if (typeof group.options === 'function') {
      // Same contravariance gap as the render path: the param type is inferred
      // per group, so we describe the group as params-taking to call it.
      const compute = group.options as (params: Record<string, unknown>) => ClassMap;
      for (const combination of paramCombinations(groupDomains(group))) {
        for (const value of Object.values(compute(combination))) {
          addTokens(found, value);
        }
      }
    } else {
      for (const value of Object.values(group.options)) {
        // An expansion walks its whole combination space here — this is the
        // one caller that does, so the render path can stay lazy.
        if (isExpansion(value)) {
          for (const classes of value.every()) {
            addTokens(found, classes);
          }
        } else {
          addTokens(found, value);
        }
      }
    }
  }
  return [...found];
}

/**
 * Builds a function that turns variant props into one merged className string.
 * `base` always applies; each selected group adds its option's classes;
 * `className` is merged last (deduped by `cn`). Each group's `default` and each
 * param's `default` fill in any prop the caller omits. Param `values` record
 * every possible class in the safelist.
 */
export function variants<const Groups extends Config & ValidGroups<Groups>>(options: {
  base: ClassValue;
  config: Groups;
}): ClassFn<Groups> {
  const base = options.base;
  const config = options.config;

  const defaults: Record<string, unknown> = {};
  const domains: Record<string, readonly string[]> = {};
  for (const [name, group] of Object.entries(config)) {
    if (group.default !== undefined) {
      defaults[name] = group.default;
    }
    for (const [key, spec] of Object.entries(group.params ?? {})) {
      if (spec.default !== undefined) {
        defaults[key] = spec.default;
      }
    }
    // An axis declares its own resting value, so an options-declared param
    // gets a default without the group restating one.
    for (const ax of groupAxes(group)) {
      defaults[ax.name] ??= ax.fallback;
    }
    // Same helper the enumeration uses, so `axes` can never describe a domain
    // the safelist was not expanded over.
    Object.assign(domains, groupDomains(group));
  }

  const classes = enumerateClasses(base, config);
  for (const className of classes) {
    SAFELIST.add(className);
  }

  const axes: Axes = { groups: collectGroups(config), params: domains };

  const classFn = (props?: Props<Groups>): string => {
    const selection: Record<string, unknown> = { ...defaults };
    for (const [name, value] of Object.entries(props ?? {})) {
      if (value !== undefined) {
        selection[name] = value;
      }
    }

    const selected: ClassValue[] = [base];
    for (const [name, group] of Object.entries(config)) {
      const option = selection[name];
      if (typeof option !== 'string') {
        continue;
      }
      // Function groups read the params off the selection. Their param types
      // are inferred per group, so TS can't check this call — but the runtime
      // shape always matches, so we describe the group as params-taking here.
      const classMap =
        typeof group.options === 'function'
          ? (group.options as (params: Record<string, unknown>) => ClassMap)(selection)
          : group.options;
      const value = classMap[option];
      // An expansion resolves against the selection and memoises, so this is a
      // cache hit after the first render of a given combination — where a
      // function group rebuilds every option's classes to read one of them.
      selected.push(isExpansion(value) ? value.at(selection) : value);
    }

    const extra = selection.className;
    return cn(selected, typeof extra === 'string' ? extra : undefined);
  };

  return Object.assign(classFn, { classes, axes });
}

