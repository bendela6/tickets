import {
  type ContextType,
  Fragment,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { useSelector } from '@tanstack/react-form';
import { formStore } from '../utils/form-store';
import type {
  ActionDefinition,
  AnyLayouts,
  FormRegistry,
  InputRegistry,
  LayoutComponentRegistry,
} from '../types/registry';
import type { LayoutNode } from '../types/layout-node';
import type { ActionNode } from '../types/action-node';
import type { SlotNode } from '../types/slot-node';
import type { FieldNode } from '../types/field-node';
import type { WhenClause } from '../types/when';
import { evaluateWhen } from '../when/evaluate-when';
import { collectWhenDeps } from '../when/collect-when-deps';
import { useResolvedConfig } from '../async/use-resolved-config';
import { fieldIds } from './field-ids';
import { FormContext } from './form-context';
import { shallowEqual } from '../utils/shallow-equal';
import { CommitContext } from './commit-context';
import { useChanged } from './use-changed';
import { SlotsContext } from './slots-context';
import { FieldWrapperContext } from './field-wrapper-context';

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
  if (node.kind === 'slot') {
    return `s:${(node as SlotNode).name}`;
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
  if (props.node.kind === 'action') {
    return <ActionRenderer node={props.node as ActionNode} action={props.registry.action} />;
  }
  if (props.node.kind === 'slot') {
    return <SlotRenderer name={(props.node as SlotNode).name} />;
  }
  const childNodes = 'children' in props.node ? props.node.children : [];
  // Cast: past the field and action kinds it's a layout node, but with generics
  // the `Exclude` does not simplify, so we cast loosely.
  const layoutNode = props.node as LayoutOf;
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
  const slice = useSelector(
    formStore<{ values: Record<string, unknown> }>(form.store),
    (s: { values: Record<string, unknown> }) => {
      const out: Record<string, unknown> = {};
      for (const d of deps) {
        out[d] = s.values[d];
      }
      return out;
    },
    { compare: shallowEqual },
  );
  if (!when) {
    return true;
  }
  return evaluateWhen(when, slice);
}

function FieldRenderer<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: { field: FieldNode<I> } & Omit<WalkProps<I, L>, 'nodes'>,
): ReactNode {
  const { resolved, loading, error: configError, depValues } = useResolvedConfig(props.field);
  const fieldState = useFormFieldState(props.field.name);
  const { inputs } = props.registry;
  const kind = props.field.type as string;
  const empty = inputs.has(kind) ? inputs.get(kind).defaultValue : undefined;
  useClearOnDepsChange(props.field.name, depValues, empty);
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('walkTree must be inside <Form>');
  }
  const isSubmitting = useSelector(
    formStore<{ isSubmitting: boolean }>(form.store),
    (s: { isSubmitting: boolean }) => s.isSubmitting,
  );
  if (!inputs.has(kind)) {
    throw new Error(`<Form>: registry has no entry for type "${String(props.field.type)}"`);
  }
  const def = inputs.get(kind);
  const Component = def.Component;
  const { name, readOnly } = props.field;
  const wrapper = useContext(FieldWrapperContext);
  const { commits, commit } = useCommitScope();
  const saving = useSyncExternalStore(commits.subscribe, () => commits.saving(name));
  const commitError = useSyncExternalStore(commits.subscribe, () => commits.error(name));
  // A failed save is the field's problem as much as a failed check: it's
  // shown at once, since the reader just committed the value it's about.
  const error = fieldState.error ?? commitError;
  const ids = fieldIds(name, props.field.description, error ?? configError);

  // The registry's `any` parameterization (InputDefinition<any, any>) is what bridges
  // these prop types. We keep the value/config plumbing untyped here intentionally —
  // each Component's own definition narrows them at use-sites.
  const inputElement = (
    <Component
      name={props.field.name}
      label={props.field.label}
      value={fieldState.value}
      // A read-only field takes no change from its input.
      onChange={(next: unknown) => {
        if (!readOnly) {
          commits.commit(name, next);
        }
      }}
      commit={commit}
      onDraft={(draft: unknown) => {
        if (!readOnly) {
          commits.draft(name, draft);
        }
      }}
      saving={saving}
      onBlur={fieldState.markTouched}
      config={resolved}
      error={error}
      loading={loading}
      configError={configError}
      disabled={isSubmitting}
      readOnly={readOnly}
      describedBy={ids.describedBy}
    />
  );

  const FieldWrapper = (wrapper ?? props.registry.field).Component;
  return (
    <FieldWrapper
      name={props.field.name}
      type={props.field.type as string}
      label={props.field.label}
      description={props.field.description}
      required={props.field.required ?? false}
      error={error}
      descriptionId={ids.descriptionId}
      errorId={ids.errorId}
      touched={fieldState.touched}
      loading={loading}
      configError={configError}
      saving={saving}
    >
      {inputElement}
    </FieldWrapper>
  );
}

/**
 * A submit or reset button, drawn by the registry's `action` or as a plain
 * `<button>`. Both wait while a submit runs; a reset waits for a change to
 * put back.
 */
function ActionRenderer(props: { node: ActionNode; action?: ActionDefinition }): ReactNode {
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('walkTree must be inside <Form>');
  }
  const isSubmitting = useSelector(
    formStore<{ isSubmitting: boolean }>(form.store),
    (s: { isSubmitting: boolean }) => s.isSubmitting,
  );
  const { commits, reset: resetForm } = useCommitScope();
  // Whether a reset has anything to put back: the values differ from where
  // they started, or from what was last submitted, as its `to` says.
  const { action, label, to } = props.node;
  const changed = useChanged(form, commits, to);
  const reset = action === 'reset';
  const disabled = isSubmitting || (reset && !changed);
  const onClick = reset ? () => resetForm({ to }) : undefined;
  const Button = props.action?.Component;
  if (Button) {
    return (
      <Button
        action={action}
        label={label}
        disabled={disabled}
        loading={!reset && isSubmitting}
        onClick={onClick}
      />
    );
  }
  return (
    <button type={reset ? 'button' : 'submit'} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

function useCommitScope() {
  const scope = useContext(CommitContext);
  if (!scope) {
    throw new Error('walkTree must be inside <Form>');
  }
  return scope;
}

/** What the app gave `<Form slots>` under this name, where the slot sits; nothing when it gave none. */
function SlotRenderer(props: { name: string }): ReactNode {
  const slots = useContext(SlotsContext);
  return slots[props.name] ?? null;
}

/** A node past the field, action and slot kinds: a layout. */
type LayoutOf = Exclude<
  LayoutNode<InputRegistry, LayoutComponentRegistry>,
  FieldNode<InputRegistry> | ActionNode | SlotNode
>;

function LayoutWrapper(props: {
  node: LayoutOf;
  layouts: AnyLayouts;
  children: ReactNode;
}): ReactNode {
  return <Fragment>{renderForKind(props.layouts, props.node, props.children)}</Fragment>;
}

// Resolves the layout component for a node from the registry. The node's
// `props` payload is read directly — there are no built-in kinds, so every
// layout is a custom layout registered in the layouts map. Missing entries
// fall through to `children` so a flat config still renders without a
// layouts map.
function renderForKind(layouts: AnyLayouts, node: LayoutOf, children: ReactNode): ReactNode {
  if (!layouts.has(node.kind)) {
    return children;
  }
  const def = layouts.get(node.kind);
  const Layout = def.Component;
  const drawn = <Layout props={(node as { props: unknown }).props}>{children}</Layout>;
  // Its fields, at any depth, get the wrapper it names, until another names its own.
  return def.field ? (
    <FieldWrapperContext.Provider value={def.field}>{drawn}</FieldWrapperContext.Provider>
  ) : (
    drawn
  );
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

/**
 * Puts a field back to its kind's empty value when a field its config is
 * loaded from changes. What it held was picked from config that no longer
 * applies: a city of the region before. The values it starts with stay, so
 * a stored record opens as it was saved.
 */
function useClearOnDepsChange(name: string, depValues: Record<string, unknown>, empty: unknown) {
  const form = useContext(FormContext);
  useEffect(() => {
    if (!form) {
      return;
    }
    // Kept by form rather than by mount: a field `when` hid while its region
    // changed comes back with the change already seen.
    let seen = SEEN_DEPS.get(form);
    if (!seen) {
      seen = new Map();
      SEEN_DEPS.set(form, seen);
    }
    const before = seen.get(name);
    seen.set(name, depValues);
    if (before && !shallowEqual(before, depValues)) {
      form.setFieldValue(name, empty);
    }
  }, [form, name, depValues, empty]);
}

/** The values each field's config was last loaded from, by form. */
const SEEN_DEPS = new WeakMap<object, Map<string, Record<string, unknown>>>();

function useFormFieldState(name: string) {
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('walkTree must be inside <Form>');
  }
  const value = useSelector(
    formStore<{ values: Record<string, unknown> }>(form.store),
    (s: { values: Record<string, unknown> }) => s.values[name],
  );
  // tanstack's form store carries per-field meta under `fieldMeta` (the derived
  // map containing `errors`, `isTouched`, etc.). Subscribing to just this
  // field's slice keeps re-renders scoped.
  const meta = useSelector(
    formStore<{ fieldMeta?: Record<string, FieldMetaShape> }>(form.store),
    (s: { fieldMeta?: Record<string, FieldMetaShape> }) => s.fieldMeta?.[name],
    { compare: metaEqual },
  );
  const submitted = useSelector(
    formStore<{ submissionAttempts: number }>(form.store),
    (s: { submissionAttempts: number }) => s.submissionAttempts > 0,
  );
  const touched = meta?.isTouched ?? false;
  // Leaving a field checks the whole form, so every visible field has its
  // problem from then on. One shows it once the reader has left it, or once
  // they have tried to submit: never on a field they have not reached.
  const error = touched || submitted ? formatFieldError(meta?.errors?.[0]) : undefined;
  return {
    value,
    error,
    touched,
    // Marks the field left, then runs blur-cause validation: tanstack's
    // form-level `validators.onBlur` runs against the whole form. With no
    // tanstack field mounted, `validateField` does not mark it, so we do.
    markTouched: () => {
      form.setFieldMeta(name, (prev) => ({ ...prev, isTouched: true, isBlurred: true }));
      void Promise.resolve(form.validateField(name, 'blur')).then(() => {
        forgetSubmitProblems(form);
      });
    },
  };
}

/**
 * Drops what the last submit said about each field, once a blur check has
 * run. The two run the same validator over the whole form, so the blur's
 * answer is the newer one: a field put right loses its problem, and one still
 * wrong keeps it. tanstack keeps a submit's problems until the next submit,
 * so without this a reader who fixed a field still saw "Name is needed".
 */
function forgetSubmitProblems(form: NonNullable<ContextType<typeof FormContext>>) {
  for (const [field, meta] of Object.entries(form.state.fieldMeta ?? {})) {
    if (meta?.errorMap?.onSubmit !== undefined) {
      form.setFieldMeta(field, (prev) => {
        return { ...prev, errorMap: { ...prev.errorMap, onSubmit: undefined } };
      });
    }
  }
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
