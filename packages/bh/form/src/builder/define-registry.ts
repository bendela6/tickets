import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';

/** Names a builder keeps for itself: its buttons and slots, and a node's own kinds. */
const RESERVED_INPUTS = ['submit', 'reset', 'slot'];
const RESERVED_LAYOUTS = ['submit', 'reset', 'slot', 'field', 'action'];

/**
 * Types a registry: the inputs a form may name, its layouts, the wrappers
 * drawn around each field and around the form, and its button. Returns it as
 * given; the types are what `defineForm` builds against. Throws on an input
 * or a layout named `submit`, `reset` or `slot`, which are the builder's own,
 * and a layout named for a node's own kind.
 */
export function defineRegistry<I extends InputRegistry, L extends LayoutComponentRegistry>(
  registry: FormRegistry<I, L>,
): FormRegistry<I, L> {
  for (const name of RESERVED_INPUTS) {
    if (registry.inputs.has(name)) {
      throw new Error(
        `defineRegistry: "${name}" is the builder's own node; name the input another way`,
      );
    }
  }
  for (const name of RESERVED_LAYOUTS) {
    if (registry.layouts.has(name)) {
      throw new Error(
        `defineRegistry: "${name}" is taken by the form's own nodes; name the layout another way`,
      );
    }
  }
  return registry;
}
