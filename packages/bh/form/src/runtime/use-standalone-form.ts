import { useSelector } from '@tanstack/react-form';
import { formStore } from '../utils/form-store';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';
import type { FormConfig } from '../types/form-config';
import { useForm } from './use-form';
import { useRegistryOf } from './form-provider';
import { selectFormError } from './select-form-error';
import { collectVisibleFields } from './collect-visible-fields';
import { waitForResolutions } from '../async/wait-for-resolutions';
import type { ResolverCache } from '../async/resolver-cache';

/** A form held outside `<Form>`: its state, and what a button of its own can do. */
export interface FormApi {
  /** Whether any value has changed since the start or the last reset. */
  isDirty: boolean;
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
  /** Submits as the form's own submit button would: waits, checks, then calls `onSubmit`. */
  submit: () => Promise<void>;
  /** Puts every value back to where it started. */
  reset: () => void;
  /** Every value now, hidden fields' too. */
  getValues: () => Record<string, unknown>;
  /** What `<Form formApi>` draws from; not for an app's own code. */
  __internals: {
    form: unknown;
    cache: ResolverCache;
    config: FormConfig<InputRegistry, LayoutComponentRegistry>;
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
  /** Called on submit, once every check passes, with the visible fields' values. */
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
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
    onSubmit: options.onSubmit,
    schema: options.schema,
  });
  const f = internals.form;
  const isDirty = useSelector(
    formStore<{ isDirty: boolean }>(f.store),
    (s: { isDirty: boolean }) => s.isDirty,
  );
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
    isSubmitting,
    isValid,
    formError,
    // Visibility-aware async-resolver gate: matches the `<form onSubmit>`
    // gate in `<FormShell>` so an external Save button (the use case this
    // hook exists for) cannot bypass it. Visible fields are computed at
    // call-time against the latest values so a field that just became
    // visible is still gated correctly.
    submit: async () => {
      const visible = collectVisibleFields(options.form.nodes, internals.getValues());
      await waitForResolutions(internals.cache, visible);
      await f.handleSubmit();
    },
    reset: () => {
      f.reset();
    },
    getValues: () => internals.getValues(),
    __internals: {
      form: f,
      cache: internals.cache,
      config: options.form as unknown as FormConfig<InputRegistry, LayoutComponentRegistry>,
    },
  };
}
