import { type ReactNode, useContext } from 'react';
import { useStore } from '@tanstack/react-form';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FormConfig } from '../types/form-config';
import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { useForm } from './use-form';
import { FormContext } from './form-context';
import { ResolverCacheContext } from '../async/resolver-cache-context';
import type { ResolverCache } from '../async/resolver-cache';
import { waitForResolutions } from '../async/wait-for-resolutions';
import { collectVisibleFields } from './collect-visible-fields';
import { WalkTree } from './walk-tree';
import { selectFormError } from './select-form-error';
import type { FormApi } from './use-standalone-form';

interface CommonProps<I extends InputRegistry, L extends LayoutComponentRegistry> {
  config: FormConfig<I, L>;
  registry: FormRegistry<I, L>;
  /**
   * Optional slot for rendering the current form-level error (top-level
   * schema issues with no path or multi-segment paths). Rendered above
   * `<WalkTree>` when truthy. Skipped when no form-level error is set.
   */
  renderFormError?: (msg: string) => ReactNode;
}

interface InlineFormProps<
  I extends InputRegistry,
  L extends LayoutComponentRegistry,
> extends CommonProps<I, L> {
  defaultValues?: Record<string, unknown>;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  /**
   * Cross-field schema. Only valid in inline mode — when `formApi` is
   * supplied, the schema lives on `useStandaloneForm` instead.
   */
  schema?: StandardSchemaV1;
  formApi?: never;
}

interface ApiFormProps<
  I extends InputRegistry,
  L extends LayoutComponentRegistry,
> extends CommonProps<I, L> {
  formApi: FormApi;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type FormProps<I extends InputRegistry, L extends LayoutComponentRegistry = {}> =
  InlineFormProps<I, L> | ApiFormProps<I, L>;

// Discriminator: picks the matching leaf based on whether `formApi` was
// supplied. Hooks live in the leaves only — calling `useForm` inside this
// component (regardless of mode) would build a phantom tanstack form whenever
// `formApi` is passed in, duplicating `collectFields`, validators, and the
// store. The leaves keep `useForm` calls scoped to the mode that needs one.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function Form<I extends InputRegistry, L extends LayoutComponentRegistry = {}>(
  props: FormProps<I, L>,
): ReactNode {
  if (props.formApi !== undefined) {
    return <FormWithApi<I, L> {...props} />;
  }
  return <FormInline<I, L> {...props} />;
}

// Inline-mode leaf: builds its own tanstack form via `useForm`. The cache is
// owned by `useForm` so the same instance powers both the submit gate here
// and any external `useStandaloneForm.submit()` call (api mode).
function FormInline<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: InlineFormProps<I, L>,
): ReactNode {
  const { form, cache } = useForm<I, L>({
    config: props.config,
    defaultValues: props.defaultValues,
    onSubmit: props.onSubmit,
    schema: props.schema,
  });
  return (
    <FormShell<I, L>
      form={form}
      cache={cache}
      config={props.config}
      registry={props.registry}
      renderFormError={props.renderFormError}
    />
  );
}

// Api-mode leaf: reuses the tanstack form and resolver cache already living
// on `formApi`. Reading `cache` from `__internals` (rather than minting a new
// one here) is what lets `useStandaloneForm.submit()` see the same in-flight
// resolvers `<Form>` does.
function FormWithApi<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: ApiFormProps<I, L>,
): ReactNode {
  const { form, cache } = props.formApi.__internals;
  return (
    <FormShell<I, L>
      form={form}
      cache={cache}
      config={props.config}
      registry={props.registry}
      renderFormError={props.renderFormError}
    />
  );
}

interface FormShellProps<
  I extends InputRegistry,
  L extends LayoutComponentRegistry,
> extends CommonProps<I, L> {
  form: unknown;
  cache: ResolverCache;
}

// Shared rendering layer: providers, the actual `<form>` element with the
// submission gate, the optional form-level error slot, and the tree walker.
// Both leaves funnel through this component so behavior stays identical
// regardless of which mode built the tanstack form.
function FormShell<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: FormShellProps<I, L>,
): ReactNode {
  const { form, cache } = props;
  const Root = props.registry.root?.Component;
  const tree = (
    <>
      {props.renderFormError && <FormErrorSlot render={props.renderFormError} />}
      <WalkTree<I, L> nodes={props.config.nodes} registry={props.registry} />
    </>
  );
  return (
    <FormContext.Provider value={form as never}>
      <ResolverCacheContext.Provider value={cache}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            // Compute the visible-field set at submit time so the gate uses
            // the latest values — a resolver in a field that just became
            // hidden mid-flight should not block submission.
            const values = (form as { state: { values: Record<string, unknown> } }).state.values;
            const visible = collectVisibleFields(props.config.nodes, values);
            await waitForResolutions(cache, visible);
            await (form as { handleSubmit: () => Promise<void> }).handleSubmit();
          }}
        >
          {Root ? <Root>{tree}</Root> : tree}
        </form>
      </ResolverCacheContext.Provider>
    </FormContext.Provider>
  );
}

// Subscribes to the current form-level error inside the FormContext and
// invokes `render` only when a string error is present. Kept as a small
// internal component so the Form body itself does not re-render whenever
// the error map changes.
function FormErrorSlot(props: { render: (msg: string) => ReactNode }): ReactNode {
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('<Form> internal: missing FormContext');
  }
  const msg = useStore(form.store as Parameters<typeof useStore>[0], selectFormError);
  if (!msg) {
    return null;
  }
  return <>{props.render(msg)}</>;
}
