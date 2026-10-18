import * as v from 'valibot';
import { defineRegistry, type RegistryOf } from '@bh/registry';
import { baseKinds } from './kinds';
import { baseOperators } from './operators';
import type { FormatSpec, KindSpec, OperatorSpec } from './types';
import { nameSchema } from './words';

/**
 * The operators an app runs with, by name: bh's fifteen (baseOperators), or a
 * registry of them with the app's own beside them.
 */
export type OperatorRegistry = RegistryOf<OperatorSpec>;

/**
 * The kinds an app runs with, by name: bh's fifteen (baseKinds), or a
 * registry of them with the app's own beside them.
 */
export type KindRegistry = RegistryOf<KindSpec>;

/**
 * What a format registry checks of each format, as @bh/template's does with
 * its function beside: a word for its name, the kinds it takes, at least one,
 * and its options' schema.
 */
export const formatData = v.object({
  name: nameSchema,
  kinds: v.pipe(v.array(nameSchema), v.minLength(1, 'takes a kind at least')),
  options: v.optional(
    v.custom<v.GenericSchema>(
      (value) => typeof value === 'object' && value !== null,
      'is a valibot schema',
    ),
  ),
});

/**
 * What an app runs with: the kinds, the operators and the formats, each a
 * registry. Its metadata, queries, writes and rows are checked against it
 * (metaOf, queryOf, createOf, patchOf, rowOf).
 *
 * bh's formats come with @bh/template (TK-79.4), which builds on this package,
 * so this one registers none: an app passes them in (createRegistry's
 * `formats`), with its own beside them. `Format` is what their entries are, a
 * FormatSpec and more (a formatter's function), so the registry hands them
 * back as they went in.
 */
export interface Registry<Format extends FormatSpec = FormatSpec> {
  /** bh's fifteen, in their table's order, then the app's own. */
  readonly kinds: KindRegistry;
  /** The formats passed in, in their order. */
  readonly formats: RegistryOf<Format>;
  /** bh's fifteen, in their order, then the app's own. */
  readonly operators: OperatorRegistry;
}

/** What createRegistry takes: each registry, bh's when one is left out. */
export interface RegistryEntries<Format extends FormatSpec = FormatSpec> {
  /** bh's kinds and the app's own (`baseKinds.register({ color })`); bh's alone when left out. */
  kinds?: KindRegistry;
  /** @bh/template's (TK-79.4) and the app's own; none → a field names no format. */
  formats?: RegistryOf<Format>;
  /** bh's operators and the app's own; bh's alone when left out. */
  operators?: OperatorRegistry;
}

/**
 * The registry an app runs with: the kinds, the operators and the formats,
 * bh's own for those it leaves out and no formats. Each registry checks its
 * own entries as they are registered; this checks them against each other as
 * it builds, so a misspelt name fails at start, not in a query: every
 * operator a kind allows registered, and every kind a format takes.
 */
export function createRegistry<Format extends FormatSpec = FormatSpec>(
  entries: RegistryEntries<Format> = {},
): Registry<Format> {
  const { kinds = baseKinds, operators = baseOperators } = entries;
  const formats = entries.formats ?? defineRegistry<Format>({ name: 'format' });
  for (const kind of kinds.values()) {
    const unknown = kind.operators.find((name) => !operators.has(name));
    if (unknown !== undefined) {
      throw new Error(
        `The kind "${kind.name}" allows "${unknown}", but no operator is registered by that name.`,
      );
    }
  }
  for (const format of formats.values()) {
    const unknown = format.kinds.find((kind) => !kinds.has(kind));
    if (unknown !== undefined) {
      throw new Error(
        `The format "${format.name}" takes "${unknown}", but no kind is registered by that name.`,
      );
    }
  }
  return Object.freeze({ kinds, formats, operators });
}
