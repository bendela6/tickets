import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';
import type { LayoutNode } from '../types/layout-node';
import type { FormConfig, FormOptions } from '../types/form-config';
import { createBuilder, type Builder } from './build-proxy';

/** What `defineForm` returns: `build` writes the form with the registry's builder. */
export interface DefineFormReturn<I extends InputRegistry, L extends LayoutComponentRegistry> {
  build: (
    buildFn: (b: Builder<I, L>) => LayoutNode<I, L>[],
    options?: FormOptions,
  ) => FormConfig<I, L>;
}

/**
 * Starts a form against a registry. `.build((b) => nodes, options)` hands over
 * a builder with a method per input kind and per layout kind, each typed by
 * its definition, and `submit` and `reset` for its buttons. It returns the
 * form `<Form form>` draws: the nodes, and the options' values to start at
 * and check across fields.
 */
export function defineForm<I extends InputRegistry, L extends LayoutComponentRegistry>(
  registry: FormRegistry<I, L>,
): DefineFormReturn<I, L> {
  const builder = createBuilder<I, L>(registry.inputs, registry.layouts);
  return {
    build: (buildFn, options) => ({ ...options, nodes: buildFn(builder) }),
  };
}
