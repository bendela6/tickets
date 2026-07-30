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
 *           soft: over(SCALE, (tone) => `bg-${tone}-3 text-${tone}-11`),
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
 */

/** Maps option names (e.g. `soft`, `md`) to the classes they apply. Values
 *  accept anything `cn` does — a string, or an array of strings — or an
 *  `over()` expansion, which stands for one set of classes per combination of
 *  the axes it declares. */
type ClassMap = Record<string, ClassValue | Expansion>;

/** A variant group: the classes each of its options applies, and which option
 *  applies when the caller names none. */
interface VariantGroup {
  default?: string;
  options: ClassMap;
}

/** A named set of variant groups. */
type Config = Record<string, VariantGroup>;

/** One optional prop per group, e.g. `{ variant?: 'soft' | 'outline' }`. */
type Selection<Groups extends Config> = {
  [Group in keyof Groups]?: keyof Groups[Group]['options'];
};

/** Tightens each group's `default` to its own option names. Used only in the
 *  `extends` constraint — `Groups` is still inferred from the bare `config`
 *  argument, so applying it here validates the config without breaking
 *  inference. */
type ValidGroups<Groups extends Config> = {
  [Group in keyof Groups]: {
    default?: keyof Groups[Group]['options'];
    options: Groups[Group]['options'];
  };
};

/** The props a group's options contribute through their `over()` expansions.
 *  Intersected, not unioned: a group whose options vary over different axes
 *  (one over tone, another over size) contributes both props, not a choice
 *  between them. */
type ExpansionParams<Group extends VariantGroup> = Intersect<
  {
    [Key in keyof Group['options']]: Group['options'][Key] extends Expansion<infer P> ? P : never;
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

/** Every prop any group's axes contribute (`never` if there are none). */
type ParamsOf<Groups extends Config> = {
  [Group in keyof Groups]: ExpansionParams<Groups[Group]>;
}[keyof Groups];

/** Adds the axis props to the props, but only when a group actually has any. */
type ParamProps<Groups extends Config> = [ParamsOf<Groups>] extends [never]
  ? unknown
  : ParamsOf<Groups>;

/** Collapses an intersection into a single object for readable hovers. */
type Prettify<T> = {
  [Key in keyof T]: T[Key];
};

/** Everything a caller may pass: a choice per group, the axis props, a className. */
type Props<Groups extends Config> = Prettify<
  Selection<Groups> & ParamProps<Groups> & { className?: string }
>;

/** The selectable axes of a built class function: each group's option names,
 *  and each axis's domain. Drives tooling from the same config that produces
 *  the classes. */
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

/** Splits a class value into individual tokens. */
function addTokens(into: Set<string>, value: ClassValue): void {
  for (const token of clsx(value).split(/\s+/)) {
    if (token) {
      into.add(token);
    }
  }
}

/** Every axis any of a group's options varies over, deduped by name. Two
 *  options sharing an axis (the usual case — each variant over the same tone)
 *  contribute it once. */
function groupAxes(group: VariantGroup): Axis[] {
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

/** Expands a config into every class it can produce. */
function enumerateClasses(base: ClassValue, config: Config): string[] {
  const found = new Set<string>();
  addTokens(found, base);
  for (const group of Object.values(config)) {
    for (const value of Object.values(group.options)) {
      // An expansion walks its whole combination space here — this is the one
      // caller that does, so the render path can stay lazy.
      if (isExpansion(value)) {
        for (const classes of value.every()) {
          addTokens(found, classes);
        }
      } else {
        addTokens(found, value);
      }
    }
  }
  return [...found];
}

/**
 * Builds a function that turns variant props into one merged className string.
 * `base` always applies; each selected group adds its option's classes;
 * `className` is merged last (deduped by `cn`). Each group's `default`, and
 * each axis's own resting value, fill in any prop the caller omits.
 */
export function variants<const Groups extends Config & ValidGroups<Groups>>(options: {
  base: ClassValue;
  config: Groups;
}): ClassFn<Groups> {
  const base = options.base;
  const config = options.config;

  const defaults: Record<string, unknown> = {};
  const domains: Record<string, readonly string[]> = {};
  const groups: Record<string, readonly string[]> = {};
  for (const [name, group] of Object.entries(config)) {
    if (group.default !== undefined) {
      defaults[name] = group.default;
    }
    groups[name] = Object.keys(group.options);
    // An axis declares its own resting value and its own domain, so a group
    // whose options vary over one restates neither.
    for (const ax of groupAxes(group)) {
      defaults[ax.name] ??= ax.fallback;
      domains[ax.name] = ax.keys;
    }
  }

  const classes = enumerateClasses(base, config);
  for (const className of classes) {
    SAFELIST.add(className);
  }

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
      const value = group.options[option];
      // An expansion resolves against the selection and memoises, so this is a
      // cache hit after the first render of a given combination.
      selected.push(isExpansion(value) ? value.at(selection) : value);
    }

    const extra = selection.className;
    return cn(selected, typeof extra === 'string' ? extra : undefined);
  };

  return Object.assign(classFn, { classes, axes: { groups, params: domains } satisfies Axes });
}
