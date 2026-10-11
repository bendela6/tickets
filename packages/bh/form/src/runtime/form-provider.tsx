import { useContext, type ReactNode } from 'react';
import type { FormRegistry, InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { RegistryContext } from './nested-fields';

/** Props for FormProvider component. */
export interface FormProviderProps<I extends InputRegistry, L extends LayoutComponentRegistry> {
  /** The inputs, layouts and wrappers every form under it is drawn with. */
  registry: FormRegistry<I, L>;
  /** The app, or the part of it whose forms take this registry. */
  children: ReactNode;
}

/**
 * Supplies the registry once, for every `<Form>` and `useStandaloneForm`
 * under it: an app wraps its root in one, and a form names only its config.
 * A form given a `registry` of its own draws with that one instead.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function FormProvider<I extends InputRegistry, L extends LayoutComponentRegistry = {}>({
  registry,
  children,
}: FormProviderProps<I, L>): ReactNode {
  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}

/**
 * The registry a form is drawn with: the one it was given, else the nearest
 * `FormProvider`'s. `who` names the form in the error when there is neither.
 */
export function useRegistryOf<I extends InputRegistry, L extends LayoutComponentRegistry>(
  own: FormRegistry<I, L> | undefined,
  who: string,
): FormRegistry<I, L> {
  const provided = useContext(RegistryContext);
  const registry = own ?? (provided as FormRegistry<I, L> | null);
  if (!registry) {
    throw new Error(
      `${who} has no registry: wrap the app in <FormProvider registry={registry}>, or give it one`,
    );
  }
  return registry;
}
