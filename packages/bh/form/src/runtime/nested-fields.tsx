import { createContext, useContext, useState, type ReactNode } from 'react';
import { isAsyncResolver } from '../types/async-config';
import type { FieldNode } from '../types/field-node';
import type { LayoutNode } from '../types/layout-node';
import type { SlotNode } from '../types/slot-node';
import type {
  AnyFormRegistry,
  FieldWrapperDefinition,
  InputRegistry,
  LayoutComponentRegistry,
} from '../types/registry';
import { evaluateWhen } from '../when/evaluate-when';
import { fieldIds } from './field-ids';
import { CommitContext } from './commit-context';
import { SlotsContext } from './slots-context';

// A form inside a field: the fields of one object (a nested object, or one
// item of a list), drawn with the registry of the <Form> around them. The
// object is the field's value, held by the field: these fields are controlled
// by it, with no form state of their own, so a list input can hold any number.

/** The registry of the `<Form>` being drawn (or the `FormProvider` around it), for an input that draws fields of its own. */
export const RegistryContext = createContext<AnyFormRegistry | null>(null);

/** The registry of the `<Form>` around an input, or of the `FormProvider`; throws outside both. */
export function useFormRegistry(): AnyFormRegistry {
  const registry = useContext(RegistryContext);
  if (!registry) {
    throw new Error('useFormRegistry must be inside <Form> or <FormProvider>');
  }
  return registry;
}

type AnyNode = LayoutNode<InputRegistry, LayoutComponentRegistry>;
type AnyField = FieldNode<InputRegistry>;

const isField = (node: AnyNode): node is AnyField => node.kind === 'field';

/**
 * A new object for these fields: each field's own default, else its input's.
 * What a list adds when asked for one more item.
 */
export function defaultValuesOf(
  nodes: readonly LayoutNode<InputRegistry, LayoutComponentRegistry>[],
  registry: AnyFormRegistry,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const node of nodes) {
    if (isField(node)) {
      values[node.name] =
        node.defaultValue ??
        (registry.inputs.has(node.type) ? registry.inputs.get(node.type).defaultValue : undefined);
    } else if ('children' in node) {
      Object.assign(values, defaultValuesOf(node.children, registry));
    }
  }
  return values;
}

/** A field's config with its plain values only: an async resolver has no form here to resolve against. */
function plainConfig(config: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(config).filter(([, value]) => !isAsyncResolver(value)));
}

/** The first problem the field's own schema finds with its value. */
function problemOf(field: AnyField, value: unknown): string | undefined {
  const result = field.validate?.['~standard'].validate(value);
  if (!result || result instanceof Promise) {
    return undefined;
  }
  return result.issues?.[0]?.message;
}

/** What `NestedFields` takes: the fields, and the object that holds their values. */
export interface NestedFieldsProps {
  /** The fields, as a FormConfig's `nodes`. */
  nodes: readonly LayoutNode<InputRegistry, LayoutComponentRegistry>[];
  /** The object their values are in, by field name. */
  value: Record<string, unknown>;
  /** Called with the whole object, one field's value changed. */
  onChange: (next: Record<string, unknown>) => void;
  /** The field these belong to, which each name is made unique under: `shortcuts.0.keys`. */
  name: string;
  /** Disables every input, as while the form submits. */
  disabled?: boolean;
  /** Makes every input read-only, as its field is: shown, never changed. */
  readOnly?: boolean;
}

/**
 * Draws the fields of one object with the surrounding form's registry: each
 * input, in the registry's field wrapper, its problem shown once it has been
 * left. Layout nodes and `when` work as they do at the top level.
 */
export function NestedFields(props: NestedFieldsProps): ReactNode {
  const registry = useFormRegistry();
  // The form's `commit` reaches these inputs too: an item's text field
  // commits, and with it the list, when the form's fields do.
  const commit = useContext(CommitContext)?.commit;
  const [left, setLeft] = useState<ReadonlySet<string>>(new Set());
  const slots = useContext(SlotsContext);

  // A form inside a field starts at the registry's wrapper; a layout of its
  // own that names one gives it to the fields inside it.
  const draw = (nodes: readonly AnyNode[], wrapper: FieldWrapperDefinition): ReactNode => {
    return nodes.map((node, index) => {
      // A button submits or resets the whole form: an item has neither.
      if (node.kind === 'action' || (node.when && !evaluateWhen(node.when, props.value))) {
        return null;
      }
      if (node.kind === 'slot') {
        const { name } = node as SlotNode;
        return <Keyed key={`s:${name}:${index}`}>{slots[name] ?? null}</Keyed>;
      }
      if (!isField(node)) {
        const layout = registry.layouts.has(node.kind)
          ? registry.layouts.get(node.kind)
          : undefined;
        const children = 'children' in node ? draw(node.children, layout?.field ?? wrapper) : null;
        if (!layout) {
          return <Keyed key={`${node.kind}:${index}`}>{children}</Keyed>;
        }
        const Layout = layout.Component;
        return (
          <Layout key={`${node.kind}:${index}`} props={(node as { props: unknown }).props}>
            {children}
          </Layout>
        );
      }
      if (!registry.inputs.has(node.type)) {
        throw new Error(`<NestedFields>: registry has no entry for type "${String(node.type)}"`);
      }
      const input = registry.inputs.get(node.type);
      const Input = input.Component;
      const Wrapper = wrapper.Component;
      const name = `${props.name}.${node.name}`;
      const value = props.value[node.name] ?? node.defaultValue ?? input.defaultValue;
      const readOnly = (props.readOnly ?? false) || node.readOnly;
      const touched = left.has(node.name);
      const error = touched ? problemOf(node, value) : undefined;
      const ids = fieldIds(name, node.description, error);
      return (
        <Wrapper
          key={`f:${node.name}`}
          name={name}
          type={node.type}
          label={node.label}
          description={node.description}
          required={node.required ?? false}
          error={error}
          descriptionId={ids.descriptionId}
          errorId={ids.errorId}
          touched={touched}
          loading={false}
        >
          <Input
            name={name}
            label={node.label}
            value={value}
            onChange={(next: unknown) => {
              if (!readOnly) {
                props.onChange({ ...props.value, [node.name]: next });
              }
            }}
            commit={commit}
            onBlur={() => setLeft((now) => new Set(now).add(node.name))}
            config={plainConfig(node.config as Record<string, unknown>)}
            error={error}
            loading={false}
            disabled={props.disabled}
            readOnly={readOnly}
            describedBy={ids.describedBy}
          />
        </Wrapper>
      );
    });
  };

  return <>{draw(props.nodes, registry.field)}</>;
}

function Keyed({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
