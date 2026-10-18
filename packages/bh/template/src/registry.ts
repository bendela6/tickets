import * as v from 'valibot';
import type { Json } from '@bh/resource';

// What a template's registries share: how a template names an entry, and
// the schemas their entries' options and functions are checked by. Each is a
// @bh/registry registry, its entries by the string a template names them by;
// entryOf reads a plain record of names, as the kinds' default renderers.

/**
 * A registry's entry by its name, or undefined when none is registered by it.
 * Only the registry's own keys count, so a template naming 'constructor' or
 * 'toString' finds nothing rather than what every object has.
 */
export function entryOf<E>(registry: Readonly<Record<string, E>>, name: string): E | undefined {
  return Object.hasOwn(registry, name) ? registry[name] : undefined;
}

/**
 * A renderer or a format as a template names it, by its name alone or as
 * {name, options}: its name, and its options, {} when it gives none.
 */
export function named(ref: string | { name: string; options: Record<string, Json> }): {
  name: string;
  options: Record<string, Json>;
} {
  return typeof ref === 'string' ? { name: ref, options: {} } : ref;
}

/** Whether a value is a valibot schema: what an entry's `options` must be. */
function isSchema(value: unknown): value is v.GenericSchema {
  return (
    typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'schema'
  );
}

/** An entry's options' schema, as a registry's schema checks it: a valibot schema. */
export const optionsSchema = v.custom<v.GenericSchema>(
  isSchema,
  'its options are a valibot schema',
);

/** One of an entry's functions, as a registry's schema checks it: `what` names it in the message. */
export function functionSchema<F>(what: string) {
  return v.custom<F>((value) => typeof value === 'function', `${what} is a function`);
}
