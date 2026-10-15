import type { ActionNode } from '../types/action-node';
import type { FormConfig } from '../types/form-config';
import type { LayoutNode } from '../types/layout-node';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import type { SlotNode } from '../types/slot-node';

/** A form's nodes, of any registry. */
type Nodes = LayoutNode<InputRegistry, LayoutComponentRegistry>[];

/** A filter form split for a narrow window: a bar, and a sheet of the fields it doesn't keep. */
export interface NarrowForms<I extends InputRegistry, L extends LayoutComponentRegistry> {
  /**
   * The kept fields and the rest of the nodes, less a submit, with the
   * `sheet` slot where the first moved field was: it applies at once.
   */
  bar: FormConfig<I, L>;
  /**
   * The moved fields, in their order, then the config's reset and its
   * submit, or one labelled `'Show {count} items'`: it applies on submit.
   */
  sheet: FormConfig<I, L>;
}

/** The slot of the bar a narrow filter form draws its Filters button and sheet in. */
export const SHEET_SLOT = 'sheet';

/** The sheet's submit when the config has none: `{count}` is the rows its value would show. */
export const SHOW_COUNT = 'Show {count} items';

/** Whether a node is a field. */
function isField(node: Nodes[number]): node is Extract<Nodes[number], { kind: 'field' }> {
  return node.kind === 'field';
}

/** Whether a node is a submit or a reset. */
function actionOf(node: Nodes[number], action: 'submit' | 'reset'): ActionNode | undefined {
  return node.kind === 'action' && (node as ActionNode).action === action
    ? (node as ActionNode)
    : undefined;
}

/** Every node of a tree, layouts' children too, in the order they're drawn. */
function flat(nodes: Nodes): Nodes {
  return nodes.flatMap((node) => {
    return 'children' in node && !isField(node) ? [node, ...flat(node.children)] : [node];
  });
}

/**
 * Splits a filter form for a narrow window, by the names of the fields its
 * bar keeps. The bar keeps those fields and the rest of its nodes, in place,
 * and puts the `sheet` slot where the first moved field was; it loses its
 * submit, since it applies at once. The sheet holds the moved fields, in
 * their order and out of their layouts, so the registry's own field wrapper
 * draws them with their labels above; then the config's reset, and its
 * submit or one labelled `'Show {count} items'`.
 */
export function narrowOf<I extends InputRegistry, L extends LayoutComponentRegistry>(
  form: FormConfig<I, L>,
  keep: readonly string[],
): NarrowForms<I, L> {
  const nodes = form.nodes as unknown as Nodes;
  const kept = new Set(keep);
  let placed = false;
  const slot: SlotNode = { kind: 'slot', name: SHEET_SLOT };

  const bar = (list: Nodes): Nodes => {
    return list.flatMap((node): Nodes => {
      if (isField(node)) {
        if (kept.has(node.name)) {
          return [node];
        }
        if (placed) {
          return [];
        }
        placed = true;
        return [slot];
      }
      if (actionOf(node, 'submit')) {
        return [];
      }
      return 'children' in node ? [{ ...node, children: bar(node.children) }] : [node];
    });
  };

  const all = flat(nodes);
  const moved = all.filter((node) => isField(node) && !kept.has(node.name));
  const reset = all.map((node) => actionOf(node, 'reset')).find(Boolean);
  const submit = all.map((node) => actionOf(node, 'submit')).find(Boolean) ?? {
    kind: 'action',
    action: 'submit',
    label: SHOW_COUNT,
  };
  const sheet: Nodes = [...moved, ...(reset ? [reset] : []), submit];

  return {
    bar: { ...form, nodes: bar(nodes) },
    sheet: { ...form, nodes: sheet },
  };
}

/** The `narrow` of a form's first layout that names one: `{ below, keep }`. */
export function narrowSpec(
  nodes: readonly LayoutNode<InputRegistry, LayoutComponentRegistry>[],
): { below: number; keep: string[] } | undefined {
  for (const node of flat(nodes as Nodes)) {
    const props = (node as { props?: { narrow?: unknown } }).props;
    const narrow = props?.narrow as { below?: unknown; keep?: unknown } | undefined;
    if (narrow && typeof narrow.below === 'number' && Array.isArray(narrow.keep)) {
      return { below: narrow.below, keep: narrow.keep as string[] };
    }
  }
  return undefined;
}
