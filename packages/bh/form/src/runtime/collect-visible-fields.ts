import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import type { LayoutNode } from '../types/layout-node';
import type { FieldNode } from '../types/field-node';
import { evaluateWhen } from '../when/evaluate-when';

/**
 * Walks the form tree and returns the set of field names that are currently
 * visible — i.e. their own `when` clause and every ancestor layout node's
 * `when` clause evaluate truthy against the supplied values.
 *
 * Used by the submit handler to strip hidden fields from the values object
 * before invoking `onSubmit`, honoring the visible-only submission contract.
 */
export function collectVisibleFields<
  R extends InputRegistry,
  L extends LayoutComponentRegistry = LayoutComponentRegistry,
>(nodes: LayoutNode<R, L>[], values: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  walk(nodes, values, out, true);
  return out;
}

function walk<R extends InputRegistry, L extends LayoutComponentRegistry>(
  nodes: LayoutNode<R, L>[],
  values: Record<string, unknown>,
  out: Set<string>,
  ancestorsVisible: boolean,
): void {
  for (const node of nodes) {
    const selfVisible = node.when ? evaluateWhen(node.when, values) : true;
    const visible = ancestorsVisible && selfVisible;
    if (node.kind === 'field') {
      if (visible) {
        out.add((node as FieldNode<R>).name);
      }
    } else if ('children' in node) {
      walk(node.children, values, out, visible);
    }
  }
}
