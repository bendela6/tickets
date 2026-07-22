import type { InputRegistry, LayoutComponentRegistry } from './registry';
import type { LayoutNode } from './layout-node';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FormConfig<R extends InputRegistry, L extends LayoutComponentRegistry = {}> {
  nodes: LayoutNode<R, L>[];
}
