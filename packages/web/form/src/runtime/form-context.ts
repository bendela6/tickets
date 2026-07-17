import { createContext } from 'react';

// The actual tanstack form instance is structurally complex; we type the context
// loosely with the slice we need (`state.values`, `store` for fine-grained
// subscriptions, and `setFieldValue`). The wider tanstack API is preserved at
// use-sites that store the form into the context.
//
// Note: tanstack exposes the reactive store as `form.store` (a `ReadonlyStore`)
// and the `useStore` hook is a separate import from `@tanstack/react-form`.
// `useFieldValue` calls `useStore(form.store, selector)` rather than a method
// on the form instance.
interface FormApiInternal {
  state: { values: Record<string, unknown> };
  store: unknown;
  setFieldValue: (name: string, value: unknown) => void;
  validateField: (name: string, cause: 'blur' | 'change' | 'submit' | 'mount') => unknown;
}

export const FormContext = createContext<FormApiInternal | null>(null);
