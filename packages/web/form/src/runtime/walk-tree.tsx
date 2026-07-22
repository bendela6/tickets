import { Fragment, type ReactNode, useContext, useMemo } from 'react';
import { useStore } from '@tanstack/react-form';
import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';
import type { LayoutNode } from '../types/layout-node';
import type { FieldNode } from '../types/field-node';
import type { WhenClause } from '../types/when';
import { evaluateWhen } from '../when/evaluate-when';
import { collectWhenDeps } from '../when/collect-when-deps';
import { useResolvedConfig } from '../async/use-resolved-config';
import { FormContext } from './form-context';
import { shallowEqual } from '../utils/shallow-equal';

export interface WalkProps<I extends InputRegistry, L extends LayoutComponentRegistry> {
  nodes: LayoutNode<I, L>[];
  registry: FormRegistry<I, L>;
}

export function WalkTree<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: WalkProps<I, L>,
): ReactNode {
  return (
    <>
      {props.nodes.map((n, i) => {
        return <NodeRenderer key={keyFor(n, i)} node={n} registry={props.registry} />;
      })}
    </>
  );
}

function keyFor<I extends InputRegistry, L extends LayoutComponentRegistry>(
  node: LayoutNode<I, L>,
  i: number,
): string {
  if (node.kind === 'field') {
    return `f:${(node as FieldNode<I>).name}`;
  }
  return `${String(node.kind)}:${i}`;
}

function NodeRenderer<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: { node: LayoutNode<I, L> } & Omit<WalkProps<I, L>, 'nodes'>,
): ReactNode {
  const visible = useVisibility(props.node.when);
  if (!visible) {
    return null;
  }

  if (props.node.kind === 'field') {
    return <FieldRenderer field={props.node as FieldNode<I>} registry={props.registry} />;
  }
  const childNodes = 'children' in props.node ? props.node.children : [];
  // Cast: outside `kind === 'field'` we know it's a layout node, but with generics
  // `Exclude<LayoutNode<I,L>, FieldNode<I>>` does not simplify, so we cast loosely.
  const layoutNode = props.node as Exclude<
    LayoutNode<InputRegistry, LayoutComponentRegistry>,
    FieldNode<InputRegistry>
  >;
  return (
    <LayoutWrapper node={layoutNode} layouts={props.registry.layouts}>
      <WalkTree nodes={childNodes} registry={props.registry} />
    </LayoutWrapper>
  );
}

function useVisibility(when: WhenClause | undefined): boolean {
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('walkTree must be inside <Form>');
  }
  const deps = useMemo(() => (when ? [...collectWhenDeps(when)] : []), [when]);
  const slice = useStore(
    form.store as Parameters<typeof useStore>[0],
    (s: { values: Record<string, unknown> }) => {
      const out: Record<string, unknown> = {};
      for (const d of deps) {
        out[d] = s.values[d];
      }
      return out;
    },
    shallowEqual,
  );
  if (!when) {
    return true;
  }
  return evaluateWhen(when, slice);
}

function FieldRenderer<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: { field: FieldNode<I> } & Omit<WalkProps<I, L>, 'nodes'>,
): ReactNode {
  const { resolved, loading, error: configError } = useResolvedConfig(props.field);
  const fieldState = useFormFieldState(props.field.name);
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('walkTree must be inside <Form>');
  }
  const isSubmitting = useStore(
    form.store as Parameters<typeof useStore>[0],
    (s: { isSubmitting: boolean }) => s.isSubmitting,
  );
  const def = props.registry.inputs[props.field.type as string];
  if (!def) {
    throw new Error(`<Form>: registry has no entry for type "${String(props.field.type)}"`);
  }
  const Component = def.Component;

  // The registry's `any` parameterization (InputDefinition<any, any>) is what bridges
  // these prop types. We keep the value/config plumbing untyped here intentionally —
  // each Component's own definition narrows them at use-sites.
  const inputElement = (
    <Component
      name={props.field.name}
      value={fieldState.value}
      onChange={fieldState.setValue}
      onBlur={fieldState.markTouched}
      config={resolved}
      error={fieldState.error}
      loading={loading}
      configError={configError}
      disabled={isSubmitting}
    />
  );

  const FieldWrapper = props.registry.field.Component;
  return (
    <FieldWrapper
      name={props.field.name}
      label={props.field.label}
      description={props.field.description}
      required={props.field.required ?? false}
      error={fieldState.error}
      touched={fieldState.touched}
      loading={loading}
      configError={configError}
    >
      {inputElement}
    </FieldWrapper>
  );
}

function LayoutWrapper(props: {
  node: Exclude<LayoutNode<InputRegistry, LayoutComponentRegistry>, FieldNode<InputRegistry>>;
  layouts: LayoutComponentRegistry;
  children: ReactNode;
}): ReactNode {
  return <Fragment>{renderForKind(props.layouts, props.node, props.children)}</Fragment>;
}

// Resolves the layout component for a node from the registry. The node's
// `props` payload is read directly — there are no built-in kinds, so every
// layout is a custom layout registered in the layouts map. Missing entries
// fall through to `children` so a flat config still renders without a
// layouts map.
function renderForKind(
  layouts: LayoutComponentRegistry,
  node: Exclude<LayoutNode<InputRegistry, LayoutComponentRegistry>, FieldNode<InputRegistry>>,
  children: ReactNode,
): ReactNode {
  const def = layouts[node.kind];
  if (!def) {
    return children;
  }
  const Layout = def.Component;
  return <Layout props={(node as { props: unknown }).props}>{children}</Layout>;
}

interface FieldMetaShape {
  isTouched?: boolean;
  errors?: unknown[];
}

function metaEqual(a: FieldMetaShape | undefined, b: FieldMetaShape | undefined): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return shallowEqual(
    a as unknown as Record<string, unknown>,
    b as unknown as Record<string, unknown>,
  );
}

function useFormFieldState(name: string) {
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('walkTree must be inside <Form>');
  }
  const value = useStore(
    form.store as Parameters<typeof useStore>[0],
    (s: { values: Record<string, unknown> }) => s.values[name],
  );
  // tanstack's form store carries per-field meta under `fieldMeta` (the derived
  // map containing `errors`, `isTouched`, etc.). Subscribing to just this
  // field's slice keeps re-renders scoped.
  const meta = useStore(
    form.store as Parameters<typeof useStore>[0],
    (s: { fieldMeta?: Record<string, FieldMetaShape> }) => s.fieldMeta?.[name],
    metaEqual,
  );
  const setValue = (v: unknown) => form.setFieldValue(name, v);
  const errorRaw = meta?.errors?.[0];
  const error = formatFieldError(errorRaw);
  return {
    value,
    setValue,
    error,
    touched: meta?.isTouched ?? false,
    // Trigger blur-cause validation. tanstack's form-level `validators.onBlur`
    // runs against the whole form, and this call also flips `isTouched` for
    // the named field — the simplest correct path for our consumer-driven
    // input components.
    markTouched: () => {
      void form.validateField(name, 'blur');
    },
  };
}

function formatFieldError(err: unknown): string | undefined {
  if (err === undefined || err === null) {
    return undefined;
  }
  if (typeof err === 'string') {
    return err;
  }
  // Standard-schema issues come through as `{ message }` objects when surfaced
  // via tanstack's form-level standard-schema validator.
  if (typeof err === 'object' && 'message' in err) {
    const m = err.message;
    if (typeof m === 'string') {
      return m;
    }
  }
  return String(err);
}
