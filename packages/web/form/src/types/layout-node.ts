import type { InputRegistry, LayoutComponentRegistry, InferLayoutComponentProps } from './registry';
import type { FieldNode } from './field-node';
import type { WhenClause } from './when';

export type CustomLayoutNode<R extends InputRegistry, L extends LayoutComponentRegistry> = {
  [K in keyof L]: {
    kind: K;
    when?: WhenClause;
    props: InferLayoutComponentProps<L[K]>;
    children: LayoutNode<R, L>[];
  };
}[keyof L];

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type LayoutNode<R extends InputRegistry, L extends LayoutComponentRegistry = {}> =
  FieldNode<R> | CustomLayoutNode<R, L>;
