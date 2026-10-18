import { defineRegistry, type StandardSchema } from '@bh/registry';
import type { InputDefinition, LayoutComponentDefinition } from '../types/registry';

// A form's inputs and layouts are @bh/registry registries, empty here: an app
// registers its own (`noInputs.register({ slug })`), or @bh/ui's beside them
// (`baseInputs.register({ slug })`), and gets a new registry each time.

/** Whether a value is a component: a function or a class, or what memo, forwardRef and lazy give. */
function isComponent(value: unknown): boolean {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  );
}

/** Checks an entry is drawn by a component, its `Component`. */
function drawnBy<T>(): StandardSchema<unknown, Partial<T>> {
  return {
    '~standard': {
      version: 1,
      vendor: 'bh',
      validate: (value) => {
        const component =
          typeof value === 'object' && value !== null
            ? (value as { Component?: unknown }).Component
            : undefined;
        return isComponent(component)
          ? { value: value as Partial<T> }
          : { issues: [{ message: 'is a component', path: ['Component'] }] };
      },
    },
  };
}

/** No inputs: what a form's inputs are registered on, each by the kind a field names. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const noInputs = defineRegistry<InputDefinition<any, any>>({
  name: 'input',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: drawnBy<InputDefinition<any, any>>(),
});

/** No layouts: what a form's layouts are registered on, each by the kind a layout node names. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const noLayouts = defineRegistry<LayoutComponentDefinition<any>>({
  name: 'layout',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: drawnBy<LayoutComponentDefinition<any>>(),
});
