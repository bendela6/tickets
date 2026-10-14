import { baseKinds } from './kinds';
import { baseOperators } from './operators';
import type { FieldKind, FormatSpec, KindSpec, Operator, OperatorSpec } from './types';

/** The operators an app runs with: bh's fifteen and its own, by name. */
export interface OperatorRegistry {
  /** bh's fifteen, in their order, then the app's own, in the order given. */
  readonly operators: readonly OperatorSpec[];
  /** The operator registered by this name; undefined when none is. */
  get(name: Operator): OperatorSpec | undefined;
}

/** The kinds an app runs with: bh's nine and its own, by name. */
export interface KindRegistry {
  /** bh's nine, in their table's order, then the app's own, in the order given. */
  readonly kinds: readonly KindSpec[];
  /** The kind registered by this name; undefined when none is. */
  get(name: FieldKind): KindSpec | undefined;
}

/** Whether `name` is a word: not empty, no space around it. */
function isName(name: unknown): name is string {
  return typeof name === 'string' && name !== '' && name === name.trim();
}

/**
 * bh's entries and the app's own, by name, in that order. Throws on an app's
 * entry `check` refuses, or named as one of bh's or as another of its own, so
 * none is replaced unseen.
 */
function byName<Spec extends { name: string }>(
  what: 'kind' | 'operator',
  base: readonly Spec[],
  own: readonly Spec[],
  check: (spec: Spec) => void,
): Map<string, Spec> {
  const entries = new Map<string, Spec>(base.map((spec) => [spec.name, spec]));
  for (const spec of own) {
    check(spec);
    if (entries.has(spec.name)) {
      throw new Error(
        base.some((each) => each.name === spec.name)
          ? `bh registers the ${what} "${spec.name}" itself; name the app's own another way.`
          : `Two ${what}s are named "${spec.name}".`,
      );
    }
    entries.set(spec.name, spec);
  }
  return entries;
}

/** Whether `label` says something: text that isn't blank. */
function says(label: unknown): boolean {
  return typeof label === 'string' && label.trim() !== '';
}

/**
 * Throws when an app's operator can't be registered: no name, no label, words
 * in its labels that say nothing, an operand that isn't a schema's maker, or
 * no `matches`.
 */
function checkOperator(spec: OperatorSpec): void {
  if (!isName(spec.name)) {
    throw new Error(`An operator is named by a word, not ${JSON.stringify(spec.name)}.`);
  }
  if (!says(spec.label)) {
    throw new Error(`The operator "${spec.name}" has no label.`);
  }
  const { many, kinds = {} } = spec.labels ?? {};
  if ((many !== undefined && !says(many)) || !Object.values(kinds).every(says)) {
    throw new Error(`The operator "${spec.name}" has words in its labels that say nothing.`);
  }
  if (spec.operand !== undefined && typeof spec.operand !== 'function') {
    throw new Error(`The operator "${spec.name}" takes its operand's schema from a function.`);
  }
  if (typeof spec.matches !== 'function') {
    throw new Error(`The operator "${spec.name}" has no matches.`);
  }
}

/**
 * Throws when an app's kind can't be registered: no name, no value schema, or
 * an operator named twice or not by a word.
 */
function checkKind(spec: KindSpec): void {
  if (!isName(spec.name)) {
    throw new Error(`A kind is named by a word, not ${JSON.stringify(spec.name)}.`);
  }
  if (typeof spec.value !== 'function') {
    throw new Error(`The kind "${spec.name}" has no value schema.`);
  }
  const seen = new Set<string>();
  for (const operator of spec.operators) {
    if (!isName(operator)) {
      throw new Error(
        `The kind "${spec.name}" names an operator ${JSON.stringify(operator)}; an operator is named by a word.`,
      );
    }
    if (seen.has(operator)) {
      throw new Error(`The kind "${spec.name}" allows "${operator}" twice.`);
    }
    seen.add(operator);
  }
}

/**
 * The registry of operators: bh's fifteen, and the app's own beside them, each
 * an OperatorSpec with its label, its operand's schema and its `matches`. A
 * kind's operators and a filter's conditions name them. Throws on an app's
 * operator named as one of bh's or as another of its own, so none is replaced
 * unseen.
 */
export function createOperatorRegistry(own: readonly OperatorSpec[] = []): OperatorRegistry {
  const entries = byName('operator', baseOperators, own, checkOperator);
  const operators = Object.freeze([...entries.values()]);
  return Object.freeze({ operators, get: (name: Operator) => entries.get(name) });
}

/**
 * The registry of kinds: bh's nine, and the app's own beside them, each a
 * KindSpec with its settings and value schemas, its operators and its flags.
 * A field's `type.kind` names one of them. Throws on an app's kind named as
 * one of bh's or as another of its own, so no kind is replaced unseen; and on
 * a kind allowing an operator `operators` doesn't hold (bh's fifteen when none
 * is given), so a misspelt name fails at start, not in a query.
 */
export function createKindRegistry(
  own: readonly KindSpec[] = [],
  operators: OperatorRegistry = createOperatorRegistry(),
): KindRegistry {
  const entries = byName('kind', baseKinds, own, checkKind);
  for (const spec of entries.values()) {
    const unknown = spec.operators.find((name) => !operators.get(name));
    if (unknown !== undefined) {
      throw new Error(
        `The kind "${spec.name}" allows "${unknown}", but no operator is registered by that name.`,
      );
    }
  }
  const kinds = Object.freeze([...entries.values()]);
  return Object.freeze({ kinds, get: (name: FieldKind) => entries.get(name) });
}

/**
 * What an app runs with: bh's kinds and operators and its own, and the
 * formats. Its metadata, queries, writes and rows are checked against it
 * (metaOf, queryOf, createOf, patchOf, rowOf).
 *
 * bh's formats come with @bh/template (TK-79.4), which builds on this package,
 * so this one registers none: an app passes them in (createRegistry's
 * `formats`), with its own beside them. `Format` is what their entries are, a
 * FormatSpec and more (a formatter's function), so the registry hands them
 * back as they went in.
 */
export interface Registry<Format extends FormatSpec = FormatSpec> {
  /** bh's nine, in their table's order, then the app's own. */
  readonly kinds: readonly KindSpec[];
  /** The formats passed in, in their order. */
  readonly formats: readonly Format[];
  /** bh's fifteen, in their order, then the app's own. */
  readonly operators: readonly OperatorSpec[];
}

/** What createRegistry takes: an app's own, each beside bh's. */
export interface RegistryEntries<Format extends FormatSpec = FormatSpec> {
  kinds?: readonly KindSpec[];
  /** @bh/template's (TK-79.4) and the app's own; none → a field names no format. */
  formats?: readonly Format[];
  operators?: readonly OperatorSpec[];
}

/**
 * Throws when a format can't be registered: no name, no kinds, a kind
 * nothing registered, or options that aren't a schema.
 */
function checkFormat(spec: FormatSpec, kinds: KindRegistry): void {
  if (!isName(spec.name)) {
    throw new Error(`A format is named by a word, not ${JSON.stringify(spec.name)}.`);
  }
  if (!Array.isArray(spec.kinds) || spec.kinds.length === 0) {
    throw new Error(`The format "${spec.name}" takes no kind.`);
  }
  const unknown = spec.kinds.find((kind) => !kinds.get(kind));
  if (unknown !== undefined) {
    throw new Error(
      `The format "${spec.name}" takes "${unknown}", but no kind is registered by that name.`,
    );
  }
  if (spec.options !== undefined && typeof spec.options !== 'object') {
    throw new Error(`The format "${spec.name}" checks its options with a valibot schema.`);
  }
}

/**
 * The registry an app runs with: bh's nine kinds and fifteen operators, its
 * own beside them, and the formats it passes in. It is checked as it is
 * built, so a mistake fails at start, not in a query: every name a word and
 * none twice or one of bh's; every operator a kind allows registered; every
 * kind a format takes registered.
 */
export function createRegistry<Format extends FormatSpec = FormatSpec>(
  entries: RegistryEntries<Format> = {},
): Registry<Format> {
  const operators = createOperatorRegistry(entries.operators);
  const kinds = createKindRegistry(entries.kinds, operators);
  const formats = new Map<string, Format>();
  for (const spec of entries.formats ?? []) {
    checkFormat(spec, kinds);
    if (formats.has(spec.name)) {
      throw new Error(`Two formats are named "${spec.name}".`);
    }
    formats.set(spec.name, spec);
  }
  return Object.freeze({
    kinds: kinds.kinds,
    formats: Object.freeze([...formats.values()]),
    operators: operators.operators,
  });
}
