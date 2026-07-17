import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';

export function defineRegistry<I extends InputRegistry, L extends LayoutComponentRegistry>(
  registry: FormRegistry<I, L>,
): FormRegistry<I, L> {
  return registry;
}
