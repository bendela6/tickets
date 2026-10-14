import type { Json } from '@bh/resource';

// What every registry of a template's (its renderers, its formats, its
// layouts) is looked up by. A registry is a plain object an app spreads bh's
// entries into and adds its own to, as a form's inputs are; a template names
// its entries by string.

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
