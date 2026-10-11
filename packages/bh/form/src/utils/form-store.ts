/**
 * The form's reactive store as the shape `useSelector` reads, narrowed to the slice a selector
 * needs. tanstack types `form.store` by the whole form's generics and this runtime carries it as
 * `unknown`, so each call site names only the fields it subscribes to.
 */
export interface FormStore<S> {
  get: () => S;
  subscribe: (listener: (value: S) => void) => { unsubscribe: () => void };
}

export function formStore<S>(store: unknown): FormStore<S> {
  return store as FormStore<S>;
}
