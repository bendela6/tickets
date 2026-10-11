import { createContext, useContext, useState, type ReactNode } from 'react';
import { isAsyncResolver } from '../types/async-config';
import type { FieldNode } from '../types/field-node';
import type { LayoutNode } from '../types/layout-node';
import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { evaluateWhen } from '../when/evaluate-when';
import { fieldIds } from './field-ids';

// A form inside a field: the fields of one object (a nested object, or one
// item of a list), drawn with the registry of the <Form> around them. The
// object is the field's value, held by the field: these fields are controlled
// by it, with no form state of their own, so a list input can hold any number.

type AnyRegistry = FormRegistry<InputRegistry, LayoutComponentRegistry>;

/** The registry of the `<Form>` being drawn (or the `FormProvider` around it), for an input that draws fields of its own. */
export const RegistryContext = createContext<AnyRegistry | null>(null);

/** The registry of the `<Form>` around an input, or of the `FormProvider`; throws outside both. */
export function useFormRegistry(): FormRegistry<InputRegistry, LayoutComponentRegistry> {
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
  registry: FormRegistry<InputRegistry, LayoutComponentRegistry>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const node of nodes) {
    if (isField(node)) {
      values[node.name] = node.defaultValue ?? registry.inputs[node.type]?.defaultValue;
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
}

/**
 * Draws the fields of one object with the surrounding form's registry: each
 * input, in the registry's field wrapper, its problem shown once it has been
 * left. Layout nodes and `when` work as they do at the top level.
 */
export function NestedFields(props: NestedFieldsProps): ReactNode {
  const registry = useFormRegistry();
  const [left, setLeft] = useState<ReadonlySet<string>>(new Set());

  const draw = (nodes: readonly AnyNode[]): ReactNode => {
    return nodes.map((node, index) => {
      // A button submits or resets the whole form: an item has neither.
      if (node.kind === 'action' || (node.when && !evaluateWhen(node.when, props.value))) {
        return null;
      }
      if (!isField(node)) {
        const children = 'children' in node ? draw(node.children) : null;
        const layout = registry.layouts[node.kind];
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
      const input = registry.inputs[node.type];
      if (!input) {
        throw new Error(`<NestedFields>: registry has no entry for type "${String(node.type)}"`);
      }
      const Input = input.Component;
      const Wrapper = registry.field.Component;
      const name = `${props.name}.${node.name}`;
      const value = props.value[node.name] ?? node.defaultValue ?? input.defaultValue;
      const touched = left.has(node.name);
      const error = touched ? problemOf(node, value) : undefined;
      const ids = fieldIds(name, node.description, error);
      return (
        <Wrapper
          key={`f:${node.name}`}
          name={name}
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
            onChange={(next: unknown) => props.onChange({ ...props.value, [node.name]: next })}
            onBlur={() => setLeft((now) => new Set(now).add(node.name))}
            config={plainConfig(node.config as Record<string, unknown>)}
            error={error}
            loading={false}
            disabled={props.disabled}
            describedBy={ids.describedBy}
          />
        </Wrapper>
      );
    });
  };

  return <>{draw(props.nodes)}</>;
}

function Keyed({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
