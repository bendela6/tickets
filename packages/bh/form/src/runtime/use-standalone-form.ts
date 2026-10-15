import { useSyncExternalStore } from 'react';
import { useSelector } from '@tanstack/react-form';
import { formStore } from '../utils/form-store';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';
import type { FormConfig } from '../types/form-config';
import { useForm } from './use-form';
import { useRegistryOf } from './form-provider';
import { selectFormError } from './select-form-error';
import type { ResolverCache } from '../async/resolver-cache';
import type { Commit } from '../types/commit';
import type { Commits, OnCommit } from './commits';
import { useChanged } from './use-changed';
import type { ResetOptions } from '../types/action-node';

/** A form held outside `<Form>`: its state, and what a button of its own can do. */
export interface FormApi {
  /**
   * Whether the form holds committed values it hasn't submitted: they
   * differ from what was last submitted, or from where it started. What
   * "Unsaved changes", a Save button and a warning on leaving the page go by.
   * Never, in a form with no `onSubmit`: it saves as it goes.
   */
  isDirty: boolean;
  /**
   * Whether a field holds a draft it hasn't committed yet, as while it's
   * typed in at `commit: 'leave'`. A Save is worth pressing then too: it
   * commits the draft first.
   */
  hasDrafts: boolean;
  /** Whether a submit is checking the values or running `onSubmit`. */
  isSubmitting: boolean;
  /** Whether the last check found no problem; true until a check runs. */
  isValid: boolean;
  /**
   * The current top-level form error, if any. Populated when a top-level
   * `schema` produces issues whose path is empty or multi-segment (i.e. they
   * cannot be attributed to a single field). Cleared once validation passes.
   */
  formError: string | undefined;
  /**
   * Submits as the form's own submit button would: commits the drafts (a
   * Save while typing loses nothing), waits for async config and for commits
   * still saving, checks, then calls `onSubmit`.
   */
  submit: () => Promise<void>;
  /**
   * Puts every value back to what was last submitted, else to where it
   * started; with `{ to: 'start' }`, always to where it started.
   */
  reset: (options?: ResetOptions) => void;
  /** Every value now, hidden fields' too. */
  getValues: () => Record<string, unknown>;
  /** What `<Form formApi>` draws from; not for an app's own code. */
  __internals: {
    form: unknown;
    cache: ResolverCache;
    config: FormConfig<InputRegistry, LayoutComponentRegistry>;
    commits: Commits;
    commit?: Commit;
    submit: () => Promise<void>;
  };
}

/** `useStandaloneForm`'s options: the form, its registry, and what to do on submit. */
export interface UseStandaloneFormOptions<
  R extends InputRegistry,
  L extends LayoutComponentRegistry = LayoutComponentRegistry,
> {
  /** The form, as `defineForm` builds it: `<Form formApi>` draws it. */
  form: FormConfig<R, L>;
  /**
   * The registry the form is drawn with: a field with no default of its own
   * starts at its input's `defaultValue`. The nearest `FormProvider`'s when
   * omitted, as `<Form>`'s is.
   */
  registry?: FormRegistry<R, L>;
  /** Values to start at, by field name, over the form's and each field's own. */
  defaultValues?: Record<string, unknown>;
  /** Values from outside that the form follows, apart from where it started. See `<Form values>`. */
  values?: Record<string, unknown>;
  /** Called on submit, once every check passes, with the visible fields' values. */
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  /**
   * Called each time a field commits, with what changed and the visible
   * fields' values after it. See `<Form onCommit>`.
   */
  onCommit?: OnCommit;
  /** When the fields commit, over the form's own `commit`. See `<Form commit>`. */
  commit?: Commit;
  /**
   * Optional cross-field schema run against the visibility-stripped values
   * after per-field validators. See `UseFormOptions['schema']`.
   */
  schema?: StandardSchemaV1;
}

/**
 * Holds a form outside `<Form>`, for a Save button, a dirty marker or a reset
 * of your own: pass what it returns to `<Form formApi>` to draw it.
 */
export function useStandaloneForm<
  R extends InputRegistry,
  L extends LayoutComponentRegistry = LayoutComponentRegistry,
>(options: UseStandaloneFormOptions<R, L>): FormApi {
  const registry = useRegistryOf(options.registry, 'useStandaloneForm');
  const internals = useForm<R, L>({
    form: options.form,
    registry,
    defaultValues: options.defaultValues,
    values: options.values,
    onSubmit: options.onSubmit,
    onCommit: options.onCommit,
    commit: options.commit,
    schema: options.schema,
  });
  const f = internals.form;
  const changed = useChanged(f, internals.commits);
  const isDirty = options.onSubmit !== undefined && changed;
  const hasDrafts = useSyncExternalStore(internals.commits.subscribe, internals.commits.hasDrafts);
  const isSubmitting = useSelector(
    formStore<{ isSubmitting: boolean }>(f.store),
    (s: { isSubmitting: boolean }) => s.isSubmitting,
  );
  const isValid = useSelector(
    formStore<{ isValid: boolean }>(f.store),
    (s: { isValid: boolean }) => s.isValid,
  );
  // Form-level error: when our wrapper returns `{ form: 'msg', fields }`,
  // tanstack normalizes the `form` value into `state.errorMap[<trigger>]`.
  // We surface whichever trigger is currently populated (onSubmit takes
  // precedence as it is the user-facing one).
  const formError = useSelector(
    formStore<Parameters<typeof selectFormError>[0]>(f.store),
    selectFormError,
  );
  return {
    isDirty,
    hasDrafts,
    isSubmitting,
    isValid,
    formError,
    // The same submit `<FormShell>`'s `<form onSubmit>` runs, so an external
    // Save button (the use case this hook exists for) can't skip a step.
    submit: internals.submit,
    reset: internals.reset,
    getValues: () => internals.getValues(),
    __internals: {
      form: f,
      cache: internals.cache,
      config: options.form as unknown as FormConfig<InputRegistry, LayoutComponentRegistry>,
      commits: internals.commits,
      commit: internals.commit,
      submit: internals.submit,
    },
  };
}
