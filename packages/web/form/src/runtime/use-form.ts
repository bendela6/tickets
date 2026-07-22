import { useMemo } from 'react';
import { useForm as useTanstackForm } from '@tanstack/react-form';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FormConfig } from '../types/form-config';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { collectFields } from './collect-fields';
import { collectVisibleFields } from './collect-visible-fields';
import { createResolverCache } from '../async/resolver-cache';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UseFormOptions<R extends InputRegistry, L extends LayoutComponentRegistry = {}> {
  config: FormConfig<R, L>;
  defaultValues?: Record<string, unknown>;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  /**
   * Optional cross-field schema run against the visibility-stripped values
   * after per-field validators. Single-segment-path issues merge into the
   * per-field error map (per-field wins on conflict); other issues become
   * form-level errors surfaced via `formApi.formError` / `renderFormError`.
   */
  schema?: StandardSchemaV1;
}

interface FormValidatorResult {
  fields: Record<string, string>;
  form?: string;
}

// Standard-schema's path is `ReadonlyArray<PropertyKey | { key: PropertyKey }>`.
// Some implementations (valibot) use the `{ key }` object form; others use bare
// keys. Normalize a single segment into a string field name, or undefined if it
// is not a string-keyed property (e.g. a numeric array index, symbol).
function pathSegmentToFieldName(
  seg: PropertyKey | { key: PropertyKey } | undefined,
): string | undefined {
  if (seg === undefined) {
    return undefined;
  }
  if (typeof seg === 'string') {
    return seg;
  }
  if (typeof seg === 'number') {
    return String(seg);
  }
  if (typeof seg === 'symbol') {
    return undefined;
  }
  if (seg && typeof seg === 'object' && 'key' in seg) {
    const k = seg.key;
    if (typeof k === 'string') {
      return k;
    }
    if (typeof k === 'number') {
      return String(k);
    }
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function useForm<R extends InputRegistry, L extends LayoutComponentRegistry = {}>(
  options: UseFormOptions<R, L>,
) {
  const fields = useMemo(() => collectFields(options.config.nodes), [options.config.nodes]);
  // Owns the resolver cache for the lifetime of this form. `<Form>` reads the
  // same cache via `useStandaloneForm.__internals.cache` (api mode) or via the
  // value returned here (inline mode), so the submit gate sees every in-flight
  // resolver regardless of whether submission is triggered from inside `<Form>`
  // or from an external `useStandaloneForm.submit()` call.
  const cache = useMemo(() => createResolverCache(), []);

  const initialValues = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const [name, node] of fields) {
      out[name] = node.defaultValue;
    }
    return { ...out, ...(options.defaultValues ?? {}) };
  }, [fields, options.defaultValues]);

  // Form-level validator: walks the live tree, evaluates `when` against current
  // values to know which fields are visible, and runs each visible field's
  // `validate` standard-schema. Hidden fields are skipped — their validation
  // does not block submission, matching the visible-only submission contract.
  //
  // After per-field iteration, also runs the optional top-level `schema`
  // against the visibility-stripped values. Single-segment string-path issues
  // merge into `fields` (per-field wins on conflict); everything else (no
  // path, multi-segment paths) joins into a `form` form-level error.
  const validator = ({
    value,
  }: {
    value: Record<string, unknown>;
  }): FormValidatorResult | undefined | Promise<FormValidatorResult | undefined> => {
    const visible = collectVisibleFields(options.config.nodes, value);
    const errors: Record<string, string> = {};
    const pending: Promise<void>[] = [];

    for (const [name, field] of fields) {
      if (!visible.has(name)) {
        continue;
      }
      const schema = field.validate;
      if (!schema) {
        continue;
      }
      const result = schema['~standard'].validate(value[name]);
      if (result instanceof Promise) {
        pending.push(
          result.then((r) => {
            const first = r.issues?.[0];
            if (first) {
              errors[name] = first.message;
            }
          }),
        );
      } else {
        const first = result.issues?.[0];
        if (first) {
          errors[name] = first.message;
        }
      }
    }

    // Builds the visibility-stripped values object for the top-level schema.
    const buildStripped = (): Record<string, unknown> => {
      const stripped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (visible.has(k)) {
          stripped[k] = v;
        }
      }
      return stripped;
    };

    // Folds top-level schema issues into `errors` (per-field wins) and a
    // `formError` string. Mutates `errors`; returns the form-level message.
    const applyTopLevelIssues = (
      issues: readonly StandardSchemaV1.Issue[] | undefined,
    ): string | undefined => {
      if (!issues || issues.length === 0) {
        return undefined;
      }
      const formMsgs: string[] = [];
      for (const issue of issues) {
        const path = issue.path;
        const onlySeg = path?.length === 1 ? path[0] : undefined;
        const fieldName = pathSegmentToFieldName(onlySeg);
        if (fieldName && visible.has(fieldName) && errors[fieldName] === undefined) {
          errors[fieldName] = issue.message;
        } else {
          formMsgs.push(issue.message);
        }
      }
      return formMsgs.length > 0 ? formMsgs.join('; ') : undefined;
    };

    // Note: tanstack treats the wrapper return as a global validation error
    // only when `'fields' in result`. We always include `fields` so a
    // form-only error (e.g. a cross-field rule firing while no per-field
    // rule does) is normalized correctly into `errorMap[trigger]`.
    const compose = (formError: string | undefined): FormValidatorResult | undefined => {
      const hasFieldErrors = Object.keys(errors).length > 0;
      if (!hasFieldErrors && !formError) {
        return undefined;
      }
      const out: FormValidatorResult = { fields: errors };
      if (formError) {
        out.form = formError;
      }
      return out;
    };

    // Sync-only fast path: no pending per-field promises and (if a top-level
    // schema is set) it returned synchronously.
    if (pending.length === 0) {
      if (!options.schema) {
        return compose(undefined);
      }
      const topResult = options.schema['~standard'].validate(buildStripped());
      if (!(topResult instanceof Promise)) {
        return compose(applyTopLevelIssues(topResult.issues));
      }
      // Top-level schema is async, no per-field pending — await just it.
      return topResult.then((r) => compose(applyTopLevelIssues(r.issues)));
    }

    // Async path: at least one per-field promise pending. Wait, then run the
    // (possibly-async) top-level schema before composing.
    return Promise.all(pending).then(async () => {
      if (!options.schema) {
        return compose(undefined);
      }
      const r = await options.schema['~standard'].validate(buildStripped());
      return compose(applyTopLevelIssues(r.issues));
    });
  };

  const form = useTanstackForm({
    defaultValues: initialValues,
    validators: {
      onBlur: validator,
      onSubmit: validator,
    },
    onSubmit: async ({ value }) => {
      // Visible-only submission: strip hidden fields before handing off to the
      // user's onSubmit. A field is visible iff its own `when` and every
      // ancestor layout node's `when` evaluate truthy against current values.
      const visible = collectVisibleFields(options.config.nodes, value);
      const stripped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (visible.has(k)) {
          stripped[k] = v;
        }
      }
      await options.onSubmit?.(stripped);
    },
  });

  return {
    form,
    fields,
    cache,
    getValues: () => form.state.values,
    setFieldValue: (name: string, value: unknown) => form.setFieldValue(name, value),
    submit: () => form.handleSubmit(),
    reset: () => form.reset(),
  };
}
