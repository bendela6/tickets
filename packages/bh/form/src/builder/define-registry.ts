import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';

/** Names a builder keeps for itself: its buttons, and a node's own kinds. */
const RESERVED_INPUTS = ['submit', 'reset'];
const RESERVED_LAYOUTS = ['submit', 'reset', 'field', 'action'];

/**
 * Types a registry: the inputs a form may name, its layouts, the wrappers
 * drawn around each field and around the form, and its button. Returns it as
 * given; the types are what `defineForm` builds against. Throws on an input
 * named `submit` or `reset`, which are the builder's buttons, and a layout
 * named for a node's own kind.
 */
export function defineRegistry<I extends InputRegistry, L extends LayoutComponentRegistry>(
  registry: FormRegistry<I, L>,
): FormRegistry<I, L> {
  for (const name of RESERVED_INPUTS) {
    if (name in registry.inputs) {
      throw new Error(
        `defineRegistry: "${name}" is the builder's own button; name the input another way`,
      );
    }
  }
  for (const name of RESERVED_LAYOUTS) {
    if (name in registry.layouts) {
      throw new Error(
        `defineRegistry: "${name}" is taken by the form's own nodes; name the layout another way`,
      );
    }
  }
  return registry;
}
