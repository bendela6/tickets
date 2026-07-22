import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import type { LayoutNode } from '../types/layout-node';
import type { FieldNode } from '../types/field-node';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function collectFields<R extends InputRegistry, L extends LayoutComponentRegistry = {}>(
  nodes: LayoutNode<R, L>[],
): Map<string, FieldNode<R>> {
  const out = new Map<string, FieldNode<R>>();
  walk(nodes, out);
  return out;
}

function walk<R extends InputRegistry, L extends LayoutComponentRegistry>(
  nodes: LayoutNode<R, L>[],
  out: Map<string, FieldNode<R>>,
): void {
  for (const node of nodes) {
    if (node.kind === 'field') {
      const field = node as FieldNode<R>;
      if (out.has(field.name)) {
        throw new Error(`collectFields: duplicate field name "${field.name}"`);
      }
      out.set(field.name, field);
    } else if ('children' in node) {
      walk(node.children, out);
    }
  }
}
