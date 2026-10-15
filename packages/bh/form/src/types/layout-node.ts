import type { InputRegistry, LayoutComponentRegistry, InferLayoutComponentProps } from './registry';
import type { ActionNode } from './action-node';
import type { FieldNode } from './field-node';
import type { WhenClause } from './when';
import type { SlotNode } from './slot-node';

/** A layout: nodes drawn inside the layout its `kind` names in the registry. */
export type CustomLayoutNode<R extends InputRegistry, L extends LayoutComponentRegistry> = {
  [K in keyof L]: {
    kind: K;
    /** Shown, with everything in it, only while this holds. */
    when?: WhenClause;
    props: InferLayoutComponentProps<L[K]>;
    children: LayoutNode<R, L>[];
  };
}[keyof L];

/** A node of a form's tree: a field, a layout holding more nodes, a button, or a slot the app fills. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type LayoutNode<R extends InputRegistry, L extends LayoutComponentRegistry = {}> =
  FieldNode<R> | CustomLayoutNode<R, L> | ActionNode | SlotNode;
