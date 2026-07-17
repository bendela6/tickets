import { useStore } from '@tanstack/react-form';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import type { FormConfig } from '../types/form-config';
import { useForm } from './use-form';
import { selectFormError } from './select-form-error';
import { collectVisibleFields } from './collect-visible-fields';
import { waitForResolutions } from '../async/wait-for-resolutions';
import type { ResolverCache } from '../async/resolver-cache';

export interface FormApi {
  isDirty: boolean;
  isSubmitting: boolean;
  isValid: boolean;
  /**
   * The current top-level form error, if any. Populated when a top-level
   * `schema` produces issues whose path is empty or multi-segment (i.e. they
   * cannot be attributed to a single field). Cleared once validation passes.
   */
  formError: string | undefined;
  submit: () => Promise<void>;
  reset: () => void;
  getValues: () => Record<string, unknown>;
  // Internal handles for <Form formApi> wiring; consumers should not use these.
  __internals: { form: unknown; cache: ResolverCache };
}

export interface UseStandaloneFormOptions<
  R extends InputRegistry,
  L extends LayoutComponentRegistry = LayoutComponentRegistry,
> {
  config: FormConfig<R, L>;
  defaultValues?: Record<string, unknown>;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  /**
   * Optional cross-field schema run against the visibility-stripped values
   * after per-field validators. See `UseFormOptions['schema']`.
   */
  schema?: StandardSchemaV1;
}

export function useStandaloneForm<
  R extends InputRegistry,
  L extends LayoutComponentRegistry = LayoutComponentRegistry,
>(options: UseStandaloneFormOptions<R, L>): FormApi {
  const internals = useForm<R, L>({
    config: options.config,
    defaultValues: options.defaultValues,
    onSubmit: options.onSubmit,
    schema: options.schema,
  });
  const f = internals.form;
  const isDirty = useStore(
    f.store as Parameters<typeof useStore>[0],
    (s: { isDirty: boolean }) => s.isDirty,
  );
  const isSubmitting = useStore(
    f.store as Parameters<typeof useStore>[0],
    (s: { isSubmitting: boolean }) => s.isSubmitting,
  );
  const isValid = useStore(
    f.store as Parameters<typeof useStore>[0],
    (s: { isValid: boolean }) => s.isValid,
  );
  // Form-level error: when our wrapper returns `{ form: 'msg', fields }`,
  // tanstack normalizes the `form` value into `state.errorMap[<trigger>]`.
  // We surface whichever trigger is currently populated (onSubmit takes
  // precedence as it is the user-facing one).
  const formError = useStore(f.store as Parameters<typeof useStore>[0], selectFormError);
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
      const visible = collectVisibleFields(options.config.nodes, internals.getValues());
      await waitForResolutions(internals.cache, visible);
      await f.handleSubmit();
    },
    reset: () => {
      f.reset();
    },
    getValues: () => internals.getValues(),
    __internals: { form: f, cache: internals.cache },
  };
}
