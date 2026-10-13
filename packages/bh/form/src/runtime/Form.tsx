import { type ReactNode, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useSelector } from '@tanstack/react-form';
import { formStore } from '../utils/form-store';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FormConfig } from '../types/form-config';
import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { useForm } from './use-form';
import { FormContext } from './form-context';
import { ResolverCacheContext } from '../async/resolver-cache-context';
import type { ResolverCache } from '../async/resolver-cache';
import { WalkTree } from './walk-tree';
import { RegistryContext } from './nested-fields';
import { useRegistryOf } from './form-provider';
import { selectFormError } from './select-form-error';
import type { FormApi } from './use-standalone-form';
import type { Commit } from '../types/commit';
import type { Commits, OnCommit } from './commits';
import { CommitContext } from './commit-context';
import { useChanged } from './use-changed';

interface CommonProps<I extends InputRegistry, L extends LayoutComponentRegistry> {
  /**
   * The inputs, layouts and wrappers it is drawn with: the nearest
   * `FormProvider`'s when omitted, which is how an app gives every form one.
   */
  registry?: FormRegistry<I, L>;
  /**
   * Draws the form-level error: what the cross-field `schema` finds that
   * names no one field. Drawn above the fields, only while there is one.
   */
  renderFormError?: (msg: string) => ReactNode;
  /**
   * Drawn inside the `<form>`, after the fields: anything that reads a value
   * with `useFieldValue`, or a button the form's own `b.submit()` cannot be.
   *
   * This is the only way for something outside the form's node tree to call
   * `useFieldValue` or to submit natively via a `<button type="submit">`,
   * since `FormContext` is not exported.
   */
  children?: ReactNode;
}

interface InlineFormProps<
  I extends InputRegistry,
  L extends LayoutComponentRegistry,
> extends CommonProps<I, L> {
  /** The form: its fields, layouts and buttons, as `defineForm` builds it. */
  form: FormConfig<I, L>;
  /** Values to start at, by field name, over the form's and each field's own. */
  defaultValues?: Record<string, unknown>;
  /** Called on submit, once every check passes, with the visible fields' values. */
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  /**
   * Called each time a field commits, with what changed (`{ field, value,
   * previous }`) and the visible fields' values after it: a form that saves
   * as you go saves here. While a promise it returns runs, the field shows
   * it's saving; if it fails, the field keeps the value and shows the error.
   */
  onCommit?: OnCommit;
  /**
   * When the fields commit: `'change'` (the default) at every keystroke,
   * `'leave'` on Enter and on leaving the field, `{ after: 800 }` on those
   * and after a pause. Over the form's own; a field's config may say otherwise.
   */
  commit?: Commit;
  /**
   * A check across fields, run on the visible fields' values after each
   * field's own, in place of the form's own. Only without `formApi`: with it,
   * the schema goes to `useStandaloneForm`.
   */
  schema?: StandardSchemaV1;
  formApi?: never;
}

interface ApiFormProps<
  I extends InputRegistry,
  L extends LayoutComponentRegistry,
> extends CommonProps<I, L> {
  /**
   * The form `useStandaloneForm` holds, to draw instead of one of its own:
   * the hook was given the form, its `defaultValues`, `onSubmit` and `schema`.
   */
  formApi: FormApi;
  form?: never;
}

/** `<Form>`'s props: a form of its own (`onSubmit`), or the one `useStandaloneForm` holds (`formApi`). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type FormProps<I extends InputRegistry, L extends LayoutComponentRegistry = {}> =
  InlineFormProps<I, L> | ApiFormProps<I, L>;

// Discriminator: picks the matching leaf based on whether `formApi` was
// supplied. Hooks live in the leaves only — calling `useForm` inside this
// component (regardless of mode) would build a phantom tanstack form whenever
// `formApi` is passed in, duplicating `collectFields`, validators, and the
// store. The leaves keep `useForm` calls scoped to the mode that needs one.
/**
 * Draws a form with a registry's inputs, layouts and buttons, inside a
 * `<form>`, and submits the visible fields' values once every check passes.
 */
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
  const registry = useRegistryOf(props.registry, '<Form>');
  const { form, cache, commits, commit, submit, reset } = useForm<I, L>({
    form: props.form,
    registry,
    defaultValues: props.defaultValues,
    onSubmit: props.onSubmit,
    onCommit: props.onCommit,
    commit: props.commit,
    schema: props.schema,
  });
  return (
    <FormShell<I, L>
      form={form}
      cache={cache}
      commits={commits}
      commit={commit}
      submit={submit}
      reset={reset}
      config={props.form}
      registry={registry}
      renderFormError={props.renderFormError}
    >
      {props.children}
    </FormShell>
  );
}

// Api-mode leaf: reuses the tanstack form and resolver cache already living
// on `formApi`. Reading `cache` from `__internals` (rather than minting a new
// one here) is what lets `useStandaloneForm.submit()` see the same in-flight
// resolvers `<Form>` does.
function FormWithApi<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: ApiFormProps<I, L>,
): ReactNode {
  const { form, cache, config, commits, commit, submit } = props.formApi.__internals;
  const registry = useRegistryOf(props.registry, '<Form>');
  return (
    <FormShell<I, L>
      form={form}
      cache={cache}
      commits={commits}
      commit={commit}
      submit={submit}
      reset={props.formApi.reset}
      config={config as unknown as FormConfig<I, L>}
      registry={registry}
      renderFormError={props.renderFormError}
    >
      {props.children}
    </FormShell>
  );
}

interface FormShellProps<
  I extends InputRegistry,
  L extends LayoutComponentRegistry,
> extends CommonProps<I, L> {
  registry: FormRegistry<I, L>;
  config: FormConfig<I, L>;
  form: unknown;
  cache: ResolverCache;
  commits: Commits;
  commit?: Commit;
  /** Commits the drafts, waits, checks, and calls `onSubmit`. */
  submit: () => Promise<void>;
  /** Puts the values back and forgets the drafts. */
  reset: () => void;
}

// Shared rendering layer: providers, the actual `<form>` element with the
// submission gate, the optional form-level error slot, and the tree walker.
// Both leaves funnel through this component so behavior stays identical
// regardless of which mode built the tanstack form.
function FormShell<I extends InputRegistry, L extends LayoutComponentRegistry>(
  props: FormShellProps<I, L>,
): ReactNode {
  const { form, cache, commits, commit, reset } = props;
  const scope = useMemo(() => ({ commits, commit, reset }), [commits, commit, reset]);
  const Root = props.registry.root?.Component;
  const tree = (
    <>
      {props.renderFormError && <FormErrorSlot render={props.renderFormError} />}
      <WalkTree<I, L> nodes={props.config.nodes} registry={props.registry} />
    </>
  );
  return (
    <FormContext.Provider value={form as never}>
      <RegistryContext.Provider value={props.registry}>
        <CommitContext.Provider value={scope}>
          <ResolverCacheContext.Provider value={cache}>
            <form
              // The fields' schemas check the values, in their own words: the
              // browser's checks (a `type="email"` input's, say) would stop a
              // submit with a bubble of their own before they ran.
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                // The same submit `useStandaloneForm`'s does: drafts commit first,
                // then it waits for the visible fields' async config (the set
                // taken now, so a field hidden mid-flight doesn't hold it) and
                // the commits still saving.
                await props.submit();
              }}
            >
              <LeaveWarning form={form} commits={commits} />
              {Root ? <Root>{tree}</Root> : tree}
              {props.children}
            </form>
          </ResolverCacheContext.Provider>
        </CommitContext.Provider>
      </RegistryContext.Provider>
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
  // The form's own problem is about fields together, so it waits for a
  // submit rather than show while the reader is still filling them in.
  const msg = useSelector(
    formStore<Parameters<typeof selectFormError>[0] & { submissionAttempts: number }>(form.store),
    (s) => (s.submissionAttempts > 0 ? selectFormError(s) : undefined),
  );
  if (!msg) {
    return null;
  }
  return <>{props.render(msg)}</>;
}

/**
 * Asks before the page is left while the form is dirty, or a field holds a
 * draft it hasn't committed: what's typed but not submitted would be lost.
 * A form with no `onSubmit` saves as it goes, and never asks.
 */
function LeaveWarning(props: { form: unknown; commits: Commits }): ReactNode {
  const { commits } = props;
  const changed = useChanged(props.form, commits);
  const drafting = useSyncExternalStore(commits.subscribe, commits.hasDrafts);
  const warn = commits.submits() && (changed || drafting);
  useEffect(() => {
    if (!warn) {
      return;
    }
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', ask);
    return () => window.removeEventListener('beforeunload', ask);
  }, [warn]);
  return null;
}
