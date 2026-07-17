import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';
import type { LayoutNode } from '../types/layout-node';
import type { FormConfig } from '../types/form-config';
import { createBuilder, type Builder } from './build-proxy';

export interface DefineFormReturn<I extends InputRegistry, L extends LayoutComponentRegistry> {
  build: (buildFn: (b: Builder<I, L>) => LayoutNode<I, L>[]) => FormConfig<I, L>;
}

export function defineForm<I extends InputRegistry, L extends LayoutComponentRegistry>(
  registry: FormRegistry<I, L>,
): DefineFormReturn<I, L> {
  const builder = createBuilder<I, L>(registry.inputs, registry.layouts);
  return {
    build: (buildFn) => ({ nodes: buildFn(builder) }),
  };
}
